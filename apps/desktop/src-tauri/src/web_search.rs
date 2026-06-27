use anyhow::Result;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};

/// 多 Key 轮询游标：每次取一个起始 Key，跨调用轮换以分摊各 Key 的额度。
static TAVILY_CURSOR: AtomicUsize = AtomicUsize::new(0);

#[derive(Debug, Deserialize)]
#[allow(non_snake_case)]
struct DuckDuckGoResponse {
    #[serde(default)]
    AbstractText: String,
    #[serde(default)]
    AbstractSource: String,
    #[serde(default)]
    AbstractURL: String,
    #[serde(default)]
    Heading: String,
    #[serde(default)]
    Answer: String,
    #[serde(default)]
    RelatedTopics: Vec<DuckDuckGoTopic>,
    #[serde(default)]
    Results: Vec<DuckDuckGoResult>,
}

#[derive(Debug, Deserialize)]
#[allow(non_snake_case)]
struct DuckDuckGoTopic {
    #[serde(default)]
    Text: String,
    #[serde(default)]
    FirstURL: String,
}

#[derive(Debug, Deserialize)]
#[allow(non_snake_case)]
struct DuckDuckGoResult {
    #[serde(default)]
    Text: String,
    #[serde(default)]
    FirstURL: String,
}

#[derive(Debug, Deserialize)]
struct TavilyResponse {
    #[serde(default)]
    answer: Option<String>,
    #[serde(default)]
    results: Vec<TavilyResult>,
}

#[derive(Debug, Deserialize)]
struct TavilyResult {
    #[serde(default)]
    title: String,
    #[serde(default)]
    url: String,
    #[serde(default)]
    content: String,
}

/// 联网搜索入口：按 `web_search_provider` 选择来源。
/// tavily 需用户在设置里填 `tavily_api_key`；未填或选 duckduckgo 时走免费的 DuckDuckGo。
pub async fn web_search(query: &str, settings: &HashMap<String, String>) -> Result<String> {
    let provider = settings
        .get("web_search_provider")
        .map(|value| value.trim())
        .unwrap_or("duckduckgo");

    if provider == "tavily" {
        let keys = settings
            .get("tavily_api_key")
            .map(|raw| parse_tavily_keys(raw))
            .unwrap_or_default();
        if !keys.is_empty() {
            return tavily_search_rotating(query, &keys).await;
        }
        // 选了 Tavily 但一个 Key 都没填：回退到免费的 DuckDuckGo，保证搜索不中断。
    }

    duckduckgo_search(query).await
}

/// 从多行/逗号分隔的文本里解析出去重后的 Key 列表。
pub(crate) fn parse_tavily_keys(raw: &str) -> Vec<String> {
    let mut keys: Vec<String> = Vec::new();
    for token in raw.split(['\n', ',']) {
        let key = token.trim();
        // 跳过空串与掩码占位；避免把 "***" 当成真实 Key。
        if key.is_empty() || key == "***" {
            continue;
        }
        if !keys.iter().any(|existing| existing == key) {
            keys.push(key.to_string());
        }
    }
    keys
}

/// 轮询多个 Key：从一个轮换起点开始依次尝试，命中即返回；单个 Key 失败（额度/鉴权/网络）就换下一个。
/// 全部失败时回退 DuckDuckGo，保证搜索不中断。
async fn tavily_search_rotating(query: &str, keys: &[String]) -> Result<String> {
    let start = TAVILY_CURSOR.fetch_add(1, Ordering::Relaxed) % keys.len();
    let mut last_err = String::new();
    for offset in 0..keys.len() {
        let key = &keys[(start + offset) % keys.len()];
        match tavily_search_once(query, key).await {
            Ok(text) => return Ok(text),
            Err(e) => last_err = e.to_string(),
        }
    }

    let fallback = duckduckgo_search(query).await?;
    Ok(format!(
        "（Tavily 的 {} 个 Key 均不可用：{}，已回退 DuckDuckGo）\n\n{}",
        keys.len(),
        last_err,
        fallback
    ))
}

/// 轻量校验单个 Tavily Key：打一次最小搜索，2xx 视为可用。
pub async fn tavily_check_key(api_key: &str) -> Result<()> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()?;

    let resp = client
        .post("https://api.tavily.com/search")
        .json(&serde_json::json!({
            "api_key": api_key,
            "query": "ping",
            "search_depth": "basic",
            "max_results": 1,
            "include_answer": false,
        }))
        .send()
        .await?;

    if resp.status().is_success() {
        Ok(())
    } else {
        anyhow::bail!("HTTP {}", resp.status().as_u16());
    }
}

async fn tavily_search_once(query: &str, api_key: &str) -> Result<String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()?;

    let resp = client
        .post("https://api.tavily.com/search")
        .json(&serde_json::json!({
            "api_key": api_key,
            "query": query,
            "search_depth": "basic",
            "max_results": 5,
            "include_answer": true,
        }))
        .send()
        .await?;

    if !resp.status().is_success() {
        // 返回 Err 以便上层轮换到下一个 Key。
        anyhow::bail!("HTTP {}", resp.status().as_u16());
    }

    let data: TavilyResponse = resp.json().await?;
    let mut parts: Vec<String> = Vec::new();

    if let Some(answer) = data
        .answer
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        parts.push(format!("摘要回答: {answer}"));
    }

    for item in &data.results {
        if item.title.is_empty() && item.content.is_empty() {
            continue;
        }
        let snippet: String = item.content.chars().take(300).collect();
        parts.push(format!("- {} ({})\n  {}", item.title, item.url, snippet));
    }

    if parts.is_empty() {
        Ok(format!("未找到与「{}」相关的搜索结果。", query))
    } else {
        Ok(parts.join("\n\n"))
    }
}

async fn duckduckgo_search(query: &str) -> Result<String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .user_agent("xiaoyan-desktop/0.3.3")
        .build()?;

    let resp = client
        .get("https://api.duckduckgo.com/")
        .query(&[
            ("q", query),
            ("format", "json"),
            ("no_html", "1"),
            ("skip_disambig", "1"),
        ])
        .send()
        .await?;

    if !resp.status().is_success() {
        return Ok(format!(
            "搜索请求失败（HTTP {}），请稍后重试。",
            resp.status().as_u16()
        ));
    }

    let data: DuckDuckGoResponse = resp.json().await?;
    let mut parts: Vec<String> = Vec::new();

    if !data.Heading.is_empty() {
        parts.push(format!("主题: {}", data.Heading));
    }
    if !data.AbstractText.is_empty() {
        let mut summary = data.AbstractText.clone();
        if !data.AbstractSource.is_empty() {
            summary.push_str(&format!(" (来源: {})", data.AbstractSource));
        }
        if !data.AbstractURL.is_empty() {
            summary.push_str(&format!(" ({})", data.AbstractURL));
        }
        parts.push(summary);
    }
    if !data.Answer.is_empty() {
        parts.push(format!("即时回答: {}", data.Answer));
    }
    for topic in &data.RelatedTopics {
        if !topic.Text.is_empty() {
            parts.push(format!("- {} ({})", topic.Text, topic.FirstURL));
        }
    }
    for result in &data.Results {
        if !result.Text.is_empty() {
            parts.push(format!("- {} ({})", result.Text, result.FirstURL));
        }
    }

    if parts.is_empty() {
        Ok(format!("未找到与「{}」相关的搜索结果。", query))
    } else {
        Ok(parts.join("\n\n"))
    }
}
