// WebDAV 低层请求与解析，供「备份同步设置」与「拉取式数据同步引擎」共用，避免重复造请求逻辑。

export interface WebdavConfig {
  url: string;
  username: string;
  password: string;
}

export interface WebdavFile {
  href: string;
  name: string;
  size: number;
  lastModified: string;
}

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** 对字符串做 base64（RN 无内置 btoa）。 */
export function encodeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    result += B64_CHARS[(triple >> 18) & 0x3f];
    result += B64_CHARS[(triple >> 12) & 0x3f];
    result += i + 1 < bytes.length ? B64_CHARS[(triple >> 6) & 0x3f] : "=";
    result += i + 2 < bytes.length ? B64_CHARS[triple & 0x3f] : "=";
  }
  return result;
}

export interface WebdavResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
}

/** 发起一次 WebDAV 请求；path 以 `/` 开头，相对于 config.url（末尾斜杠会被去除）。 */
export function webdavRequest(
  config: WebdavConfig,
  method: string,
  path: string,
  body?: string,
  depth = "1",
): Promise<WebdavResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const baseUrl = config.url.replace(/\/+$/, "");
    xhr.open(method, `${baseUrl}${path}`, true);
    xhr.setRequestHeader("Authorization", `Basic ${encodeBase64(`${config.username}:${config.password}`)}`);
    if (method === "PROPFIND") {
      xhr.setRequestHeader("Content-Type", "application/xml");
      xhr.setRequestHeader("Depth", depth);
    }
    xhr.timeout = 30000;
    xhr.onload = () => {
      const headers: Record<string, string> = {};
      xhr
        .getAllResponseHeaders()
        .split("\r\n")
        .forEach((line) => {
          const idx = line.indexOf(": ");
          if (idx > 0) headers[line.slice(0, idx).toLowerCase()] = line.slice(idx + 2);
        });
      resolve({ status: xhr.status, body: xhr.responseText, headers });
    };
    xhr.onerror = () => reject(new Error("网络请求失败"));
    xhr.ontimeout = () => reject(new Error("请求超时"));
    xhr.send(body ?? null);
  });
}

// 按本地名（无命名空间前缀）提取标签文本，兼容任意前缀（D:/d:/lp1:）或无前缀，
// 否则不同 WebDAV 服务端（Nextcloud 用 d:、部分用 lp1:）会导致解析不到任何文件。
function extractXml(xml: string, tag: string): string {
  const match = xml.match(
    new RegExp(`<(?:[A-Za-z0-9]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[A-Za-z0-9]+:)?${tag}>`, "i"),
  );
  return match ? match[1].trim() : "";
}

const PROPFIND_BODY = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:displayname/>
    <D:getcontentlength/>
    <D:getlastmodified/>
    <D:resourcetype/>
  </D:prop>
</D:propfind>`;

/** 列出某目录下的文件（跳过集合/目录条目）。dir 形如 "" 或 "/xiaoyan-sync/devices"。 */
export async function propfindFiles(config: WebdavConfig, dir = ""): Promise<WebdavFile[]> {
  const resp = await webdavRequest(config, "PROPFIND", dir || "/", PROPFIND_BODY);
  if (resp.status >= 300) return [];
  const files: WebdavFile[] = [];
  const responses = resp.body.split(/<(?:[A-Za-z0-9]+:)?response(?=[\s>])/i);
  for (let i = 1; i < responses.length; i++) {
    const chunk = responses[i];
    if (/<(?:[A-Za-z0-9]+:)?collection\s*\/>/i.test(chunk)) continue;
    const href = extractXml(chunk, "href");
    const name = extractXml(chunk, "displayname") || decodeURIComponent(href.split("/").filter(Boolean).pop() ?? href);
    const size = parseInt(extractXml(chunk, "getcontentlength") || "0", 10);
    const lastModified = extractXml(chunk, "getlastmodified") || "";
    if (size > 0 || name) files.push({ href, name, size, lastModified });
  }
  return files;
}
