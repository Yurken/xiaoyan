#!/usr/bin/env node
/**
 * 下载 yanweb-links.ts 中的所有 icon 到本地 public 目录，并更新文件中的 URL。
 * 用法：node scripts/download-friend-link-icons.mjs
 */

import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { URL } from "node:url";

const root = process.cwd();
const iconsDir = path.join(root, "apps/desktop/public/friend-link-icons");
const tsFile = path.join(root, "apps/desktop/src/lib/yanweb-links.ts");

fs.mkdirSync(iconsDir, { recursive: true });

const content = fs.readFileSync(tsFile, "utf8");

// 提取所有唯一图标 URL
const iconUrls = new Set();
for (const m of content.matchAll(/"icon":\s*"([^"]+)"/g)) {
  iconUrls.add(m[1]);
}
console.log(`发现 ${iconUrls.size} 个唯一图标 URL\n`);

/** 根据 URL 生成本地文件名 */
function urlToFilename(urlStr) {
  const u = new URL(urlStr);
  const pathname = u.pathname;

  // 保留原始 img_XXXX 文件名
  const m = pathname.match(/\/(img_[0-9a-f]+)\.(png|jpe?g|gif|webp)$/i);
  if (m) return `${m[1]}.${m[2].toLowerCase()}`;

  // arXiv 特殊路径
  if (u.hostname.includes("arxiv.org")) return "arxiv.org.png";

  // 其他站点：用域名（去掉 www.）+ 扩展名
  const host = u.hostname.replace(/^www\./, "");
  const ext = path.extname(pathname) || ".png";
  return `${host}${ext}`;
}

/** 下载单个文件，支持一次重定向 */
function downloadFile(urlStr, destPath, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 3) return reject(new Error("too many redirects"));
    const u = new URL(urlStr);
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.get(
      urlStr,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "image/*,*/*",
        },
        timeout: 12000,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const next = new URL(res.headers.location, urlStr).href;
          return downloadFile(next, destPath, redirectCount + 1)
            .then(resolve)
            .catch(reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const tmp = destPath + ".tmp";
        const file = fs.createWriteStream(tmp);
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          fs.renameSync(tmp, destPath);
          resolve();
        });
        file.on("error", (e) => {
          fs.unlink(tmp, () => {});
          reject(e);
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

const urlToLocal = new Map();
const failed = [];

for (const urlStr of iconUrls) {
  const filename = urlToFilename(urlStr);
  const destPath = path.join(iconsDir, filename);
  const localPath = `/friend-link-icons/${filename}`;

  if (fs.existsSync(destPath)) {
    urlToLocal.set(urlStr, localPath);
    console.log(`跳过（已存在）${filename}`);
    continue;
  }

  try {
    await downloadFile(urlStr, destPath);
    urlToLocal.set(urlStr, localPath);
    console.log(`OK     ${filename}`);
  } catch (err) {
    failed.push({ url: urlStr, filename, error: err.message });
    console.error(`失败   ${filename}  (${err.message})`);
  }
}

// 用本地路径替换 ts 文件中的 icon URL
let updated = content;
for (const [url, local] of urlToLocal) {
  updated = updated.replaceAll(`"icon": "${url}"`, `"icon": "${local}"`);
}
fs.writeFileSync(tsFile, updated, "utf8");

console.log(`\n完成：${urlToLocal.size} 个图标已下载并更新路径。`);
if (failed.length > 0) {
  console.log(`\n以下 ${failed.length} 个下载失败（URL 保持不变）：`);
  for (const f of failed) {
    console.log(`  ${f.url}  →  ${f.error}`);
  }
}
