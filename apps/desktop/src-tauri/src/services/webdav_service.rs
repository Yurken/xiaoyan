use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use reqwest::{Client, Method};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebdavConfig {
    pub url: String,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebdavFile {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub last_modified: String,
}

fn build_client(config: &WebdavConfig) -> Result<Client, String> {
    let mut headers = HeaderMap::new();
    let auth = format!("{}:{}", config.username, config.password);
    let encoded = base64_encode(&auth);
    let auth_value = format!("Basic {}", encoded);
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&auth_value).map_err(|e| format!("Invalid auth header: {}", e))?,
    );

    Client::builder()
        .timeout(Duration::from_secs(30))
        .default_headers(headers)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))
}

fn base64_encode(input: &str) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let bytes = input.as_bytes();
    let mut result = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;

        result.push(CHARS[((triple >> 18) & 0x3F) as usize] as char);
        result.push(CHARS[((triple >> 12) & 0x3F) as usize] as char);

        if chunk.len() > 1 {
            result.push(CHARS[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }

        if chunk.len() > 2 {
            result.push(CHARS[(triple & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

fn normalize_url(url: &str) -> String {
    url.trim_end_matches('/').to_string()
}

/// Test connection by sending a PROPFIND with Depth: 0
pub async fn test_connection(config: &WebdavConfig) -> Result<(), String> {
    let client = build_client(config)?;
    let url = normalize_url(&config.url);

    let method = Method::from_bytes(b"PROPFIND").map_err(|e| format!("Invalid method: {}", e))?;
    let resp = client
        .request(method, &url)
        .header("Depth", "0")
        .send()
        .await
        .map_err(|e| format!("连接失败: {}", e))?;

    let status = resp.status();
    if status.is_success() {
        Ok(())
    } else if status == reqwest::StatusCode::UNAUTHORIZED {
        Err("认证失败，请检查用户名和密码".into())
    } else if status == reqwest::StatusCode::NOT_FOUND {
        Err("WebDAV 路径不存在，请检查服务器地址".into())
    } else {
        Err(format!(
            "服务器返回错误: {} {}",
            status.as_u16(),
            status.canonical_reason().unwrap_or("")
        ))
    }
}

/// List backup files on the WebDAV server
pub async fn list_backups(config: &WebdavConfig) -> Result<Vec<WebdavFile>, String> {
    let client = build_client(config)?;
    let url = normalize_url(&config.url);

    let body = r#"<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:displayname/>
    <D:getcontentlength/>
    <D:getlastmodified/>
    <D:resourcetype/>
  </D:prop>
</D:propfind>"#;

    let method = Method::from_bytes(b"PROPFIND").map_err(|e| format!("Invalid method: {}", e))?;
    let resp = client
        .request(method, &url)
        .header("Depth", "1")
        .header("Content-Type", "application/xml")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("列表请求失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("服务器返回错误: {}", resp.status()));
    }

    let text = resp
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;
    parse_propfind_response(&text)
}

/// Upload encrypted backup to WebDAV
pub async fn upload_backup(
    config: &WebdavConfig,
    filename: &str,
    data: &[u8],
) -> Result<(), String> {
    let client = build_client(config)?;
    let base = normalize_url(&config.url);
    let url = format!("{}/{}", base, filename);

    let resp = client
        .put(&url)
        .body(data.to_vec())
        .send()
        .await
        .map_err(|e| format!("上传失败: {}", e))?;

    if resp.status().is_success() {
        Ok(())
    } else {
        Err(format!("上传失败: HTTP {}", resp.status()))
    }
}

/// Download backup from WebDAV
pub async fn download_backup(config: &WebdavConfig, filename: &str) -> Result<Vec<u8>, String> {
    let client = build_client(config)?;
    let base = normalize_url(&config.url);
    let url = format!("{}/{}", base, filename);

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("下载失败: {}", e))?;

    if resp.status().is_success() {
        resp.bytes()
            .await
            .map(|b| b.to_vec())
            .map_err(|e| format!("读取响应失败: {}", e))
    } else {
        Err(format!("下载失败: HTTP {}", resp.status()))
    }
}

/// Delete a backup from WebDAV
pub async fn delete_backup(config: &WebdavConfig, filename: &str) -> Result<(), String> {
    let client = build_client(config)?;
    let base = normalize_url(&config.url);
    let url = format!("{}/{}", base, filename);

    let resp = client
        .delete(&url)
        .send()
        .await
        .map_err(|e| format!("删除失败: {}", e))?;

    if resp.status().is_success() {
        Ok(())
    } else {
        Err(format!("删除失败: HTTP {}", resp.status()))
    }
}

// ───────────────────────────────────────────────────────────────────
// 通用子路径操作（供无冲突同步使用）：在 WebDAV 上以任意相对路径读写文件、
// 创建目录、判断存在、列目录。路径相对于 config.url，不带前导斜杠。
// ───────────────────────────────────────────────────────────────────

fn join_url(base: &str, path: &str) -> String {
    format!("{}/{}", normalize_url(base), path.trim_start_matches('/'))
}

/// 创建集合（目录）。已存在（405/301）视为成功。会逐级创建父目录。
pub async fn ensure_collection(config: &WebdavConfig, path: &str) -> Result<(), String> {
    let client = build_client(config)?;
    let method = Method::from_bytes(b"MKCOL").map_err(|e| format!("Invalid method: {}", e))?;

    // 逐级创建：a/b/c → a, a/b, a/b/c
    let mut prefix = String::new();
    for segment in path.trim_matches('/').split('/') {
        if segment.is_empty() {
            continue;
        }
        if prefix.is_empty() {
            prefix = segment.to_string();
        } else {
            prefix = format!("{}/{}", prefix, segment);
        }
        let url = join_url(&config.url, &prefix);
        let resp = client
            .request(method.clone(), &url)
            .send()
            .await
            .map_err(|e| format!("创建目录失败: {}", e))?;
        let status = resp.status();
        // 201 Created / 405 已存在 / 301 已存在(带斜杠重定向) 都算成功
        if status.is_success()
            || status == reqwest::StatusCode::METHOD_NOT_ALLOWED
            || status == reqwest::StatusCode::MOVED_PERMANENTLY
        {
            continue;
        }
        return Err(format!("创建目录失败: HTTP {}", status));
    }
    Ok(())
}

/// 上传文件到任意相对路径。
pub async fn put_file(config: &WebdavConfig, path: &str, data: &[u8]) -> Result<(), String> {
    let client = build_client(config)?;
    let url = join_url(&config.url, path);
    let resp = client
        .put(&url)
        .body(data.to_vec())
        .send()
        .await
        .map_err(|e| format!("上传失败: {}", e))?;
    if resp.status().is_success() {
        Ok(())
    } else {
        Err(format!("上传失败: HTTP {}", resp.status()))
    }
}

/// 下载任意相对路径的文件；404 返回 Ok(None)。
pub async fn get_file(config: &WebdavConfig, path: &str) -> Result<Option<Vec<u8>>, String> {
    let client = build_client(config)?;
    let url = join_url(&config.url, path);
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("下载失败: {}", e))?;
    let status = resp.status();
    if status.is_success() {
        resp.bytes()
            .await
            .map(|b| Some(b.to_vec()))
            .map_err(|e| format!("读取响应失败: {}", e))
    } else if status == reqwest::StatusCode::NOT_FOUND {
        Ok(None)
    } else {
        Err(format!("下载失败: HTTP {}", status))
    }
}

/// 列出某个集合（目录）下的文件（Depth 1）。目录不存在返回空列表。
pub async fn list_dir(config: &WebdavConfig, path: &str) -> Result<Vec<WebdavFile>, String> {
    let client = build_client(config)?;
    let url = join_url(&config.url, path);

    let body = r#"<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:displayname/>
    <D:getcontentlength/>
    <D:getlastmodified/>
    <D:resourcetype/>
  </D:prop>
</D:propfind>"#;

    let method = Method::from_bytes(b"PROPFIND").map_err(|e| format!("Invalid method: {}", e))?;
    let resp = client
        .request(method, &url)
        .header("Depth", "1")
        .header("Content-Type", "application/xml")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("列表请求失败: {}", e))?;

    let status = resp.status();
    if status == reqwest::StatusCode::NOT_FOUND {
        return Ok(Vec::new());
    }
    if !status.is_success() {
        return Err(format!("服务器返回错误: {}", status));
    }
    let text = resp
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;
    parse_propfind_response(&text)
}

fn parse_propfind_response(xml: &str) -> Result<Vec<WebdavFile>, String> {
    let mut files = Vec::new();
    let mut remaining = xml;

    while let Some(resp_start) = remaining.find("<D:response") {
        let resp_block = &remaining[resp_start..];
        let resp_end = resp_block.find("</D:response>").unwrap_or(resp_block.len());
        let response = &resp_block[..resp_end + "</D:response>".len()];

        let href = extract_xml_content(response, "D:href");
        let displayname = extract_xml_content(response, "D:displayname");
        let size_str = extract_xml_content(response, "D:getcontentlength");
        let modified = extract_xml_content(response, "D:getlastmodified");

        let is_collection = response.contains("<D:collection/>");
        if !is_collection && !href.is_empty() {
            let name = if !displayname.is_empty() {
                displayname
            } else {
                href.split('/').last().unwrap_or(&href).to_string()
            };

            let size: u64 = size_str.parse().unwrap_or(0);
            if size > 0 {
                files.push(WebdavFile {
                    name,
                    path: href,
                    size,
                    last_modified: modified,
                });
            }
        }

        remaining = &resp_block[resp_end + "</D:response>".len()..];
        if remaining.find("<D:response").is_none() {
            break;
        }
    }

    Ok(files)
}

fn extract_xml_content(xml: &str, tag: &str) -> String {
    let start_tag = format!("<{}>", tag);
    let end_tag = format!("</{}>", tag);

    if let Some(start) = xml.find(&start_tag) {
        let after_start = &xml[start + start_tag.len()..];
        if let Some(end) = after_start.find(&end_tag) {
            return after_start[..end].trim().to_string();
        }
    }
    String::new()
}
