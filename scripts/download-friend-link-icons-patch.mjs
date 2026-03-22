#!/usr/bin/env node
/**
 * 第二轮补丁：对首轮失败的图标尝试备用路径。
 * - 403 类：加 Referer / Accept / Cookie 伪装浏览器重试
 * - 404 类：改用 /favicon.ico 或站点特定备用 URL
 */

import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { URL } from "node:url";

const root = process.cwd();
const iconsDir = path.join(root, "apps/desktop/public/friend-link-icons");
const tsFile = path.join(root, "apps/desktop/src/lib/yanweb-links.ts");

// 仍然使用原始 URL（未被替换）的条目，说明首轮下载失败
let content = fs.readFileSync(tsFile, "utf8");
const stillRemote = new Set();
for (const m of content.matchAll(/"icon":\s*"(https?:\/\/[^"]+)"/g)) {
  stillRemote.add(m[1]);
}
console.log(`仍有 ${stillRemote.size} 个远程 URL 未下载\n`);

// 备用 URL 映射：原始 URL → 要尝试的备用 URL 列表（按优先级）
const FALLBACKS = new Map([
  // ── 主流 AI 助手 ─────────────────────────────────────────────
  ["https://gemini.google.com/apple-touch-icon.png", [
    "https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg",
    "https://gemini.google.com/favicon.ico",
  ]],
  ["https://copilot.microsoft.com/apple-touch-icon.png", [
    "https://www.microsoft.com/apple-touch-icon.png",
    "https://copilot.microsoft.com/favicon.ico",
    "https://www.bing.com/apple-touch-icon.png",
  ]],
  // ── AI 学术工具 ──────────────────────────────────────────────
  ["https://www.semanticscholar.org/apple-touch-icon.png", [
    "https://www.semanticscholar.org/favicon.ico",
  ]],
  ["https://elicit.com/apple-touch-icon.png", [
    "https://elicit.com/favicon.ico",
  ]],
  ["https://consensus.app/apple-touch-icon.png", [
    "https://consensus.app/favicon.ico",
  ]],
  ["https://typeset.io/apple-touch-icon.png", [
    "https://typeset.io/favicon.ico",
  ]],
  ["https://www.researchrabbit.ai/apple-touch-icon.png", [
    "https://www.researchrabbit.ai/favicon.ico",
  ]],
  // ── 英文文献 ─────────────────────────────────────────────────
  ["https://www.webofscience.com/apple-touch-icon.png", [
    "https://clarivate.com/apple-touch-icon.png",
    "https://www.webofscience.com/favicon.ico",
  ]],
  ["https://www.nature.com/apple-touch-icon.png", [
    "https://www.nature.com/favicon.ico",
  ]],
  ["https://www.science.org/apple-touch-icon.png", [
    "https://www.science.org/favicon.ico",
  ]],
  ["https://www.cell.com/apple-touch-icon.png", [
    "https://www.cell.com/favicon.ico",
  ]],
  ["https://www.sciencedirect.com/apple-touch-icon.png", [
    "https://www.sciencedirect.com/favicon.ico",
  ]],
  ["https://onlinelibrary.wiley.com/apple-touch-icon.png", [
    "https://onlinelibrary.wiley.com/favicon.ico",
  ]],
  ["https://www.aps.org/apple-touch-icon.png", [
    "https://www.aps.org/favicon.ico",
  ]],
  ["https://pubs.aip.org/apple-touch-icon.png", [
    "https://pubs.aip.org/favicon.ico",
  ]],
  ["https://dl.acm.org/apple-touch-icon.png", [
    "https://dl.acm.org/favicon.ico",
  ]],
  ["https://pubs.acs.org/apple-touch-icon.png", [
    "https://pubs.acs.org/favicon.ico",
  ]],
  ["https://iopscience.iop.org/apple-touch-icon.png", [
    "https://iopscience.iop.org/favicon.ico",
  ]],
  ["https://www.annualreviews.org/apple-touch-icon.png", [
    "https://www.annualreviews.org/favicon.ico",
  ]],
  ["https://global.oup.com/apple-touch-icon.png", [
    "https://global.oup.com/favicon.ico",
    "https://www.oup.com/favicon.ico",
  ]],
  ["https://ieeexplore.ieee.org/apple-touch-icon.png", [
    "https://www.ieee.org/apple-touch-icon.png",
    "https://ieeexplore.ieee.org/favicon.ico",
  ]],
  ["https://link.springer.com/apple-touch-icon.png", [
    "https://link.springer.com/favicon.ico",
    "https://www.springernature.com/apple-touch-icon.png",
  ]],
  ["https://www.pnas.org/apple-touch-icon.png", [
    "https://www.pnas.org/favicon.ico",
  ]],
  ["https://www.mdpi.com/apple-touch-icon.png", [
    "https://www.mdpi.com/favicon.ico",
  ]],
  ["https://www.asce.org/apple-touch-icon.png", [
    "https://www.asce.org/favicon.ico",
  ]],
  ["https://www.thelancet.com/apple-touch-icon.png", [
    "https://www.thelancet.com/favicon.ico",
  ]],
  ["https://jamanetwork.com/apple-touch-icon.png", [
    "https://jamanetwork.com/favicon.ico",
  ]],
  ["https://www.nejm.org/apple-touch-icon.png", [
    "https://www.nejm.org/favicon.ico",
  ]],
  ["https://www.apa.org/apple-touch-icon.png", [
    "https://www.apa.org/favicon.ico",
  ]],
  ["https://www.proquest.com/apple-touch-icon.png", [
    "https://www.proquest.com/favicon.ico",
  ]],
  ["https://mathscinet.ams.org/apple-touch-icon.png", [
    "https://www.ams.org/apple-touch-icon.png",
    "https://mathscinet.ams.org/favicon.ico",
  ]],
  ["https://static.arxiv.org/static/browse/0.3.4/images/icons/apple-touch-icon-180x180.png", [
    "https://arxiv.org/favicon.ico",
    "https://arxiv.org/apple-touch-icon.png",
  ]],
  ["https://doaj.org/apple-touch-icon.png", [
    "https://doaj.org/favicon.ico",
  ]],
  // ── 文献管理 ─────────────────────────────────────────────────
  ["https://endnote.com/apple-touch-icon.png", [
    "https://endnote.com/favicon.ico",
    "https://clarivate.com/webofsciencegroup/solutions/endnote/favicon.ico",
  ]],
  // ── 翻译工具 ─────────────────────────────────────────────────
  ["https://translate.google.com/apple-touch-icon.png", [
    "https://ssl.gstatic.com/translate/favicon.ico",
    "https://translate.google.com/favicon.ico",
  ]],
  ["https://caiyunapp.com/apple-touch-icon.png", [
    "https://caiyunapp.com/favicon.ico",
  ]],
  ["https://papago.naver.com/apple-touch-icon.png", [
    "https://papago.naver.com/favicon.ico",
  ]],
  // ── 论文写作 ─────────────────────────────────────────────────
  ["https://www.paperpal.com/apple-touch-icon.png", [
    "https://www.paperpal.com/favicon.ico",
  ]],
  ["https://www.grammarly.com/apple-touch-icon.png", [
    "https://www.grammarly.com/favicon.ico",
  ]],
  ["https://writefull.com/apple-touch-icon.png", [
    "https://writefull.com/favicon.ico",
  ]],
  // ── 答辩 PPT ─────────────────────────────────────────────────
  ["https://www.canva.com/apple-touch-icon.png", [
    "https://www.canva.com/favicon.ico",
    "https://static.canva.com/web/images/favicon.ico",
  ]],
  ["https://gamma.app/apple-touch-icon.png", [
    "https://gamma.app/favicon.ico",
  ]],
  // ── 科研绘图 ─────────────────────────────────────────────────
  ["https://app.diagrams.net/apple-touch-icon.png", [
    "https://app.diagrams.net/favicon.ico",
  ]],
  // ── 科研社区 ─────────────────────────────────────────────────
  ["https://www.researchgate.net/apple-touch-icon.png", [
    "https://www.researchgate.net/favicon.ico",
  ]],
]);

function urlToFilename(urlStr) {
  const u = new URL(urlStr);
  const p = u.pathname;
  const m = p.match(/\/(img_[0-9a-f]+)\.(png|jpe?g|gif|webp)$/i);
  if (m) return `${m[1]}.${m[2].toLowerCase()}`;
  if (u.hostname.includes("arxiv.org")) return "arxiv.org.png";
  const host = u.hostname.replace(/^www\./, "");
  const ext = path.extname(p) || ".png";
  return `${host}${ext}`;
}

function downloadFile(urlStr, destPath, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error("too many redirects"));
    const u = new URL(urlStr);
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.get(
      urlStr,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
          Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          Referer: `${u.protocol}//${u.hostname}/`,
          "Sec-Fetch-Dest": "image",
          "Sec-Fetch-Mode": "no-cors",
          "Sec-Fetch-Site": "same-origin",
        },
        timeout: 15000,
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
        // 验证是图片（至少有内容）
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          if (buf.length < 100) {
            return reject(new Error(`too small (${buf.length} bytes)`));
          }
          fs.writeFileSync(destPath, buf);
          resolve();
        });
        res.on("error", reject);
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
const stillFailed = [];

for (const [originalUrl, fallbacks] of FALLBACKS) {
  if (!stillRemote.has(originalUrl)) {
    // 已在第一轮成功，跳过
    continue;
  }

  // 目标文件名基于原始 URL（保持与 ts 文件中替换逻辑一致）
  const filename = urlToFilename(originalUrl);
  const destPath = path.join(iconsDir, filename);

  if (fs.existsSync(destPath)) {
    urlToLocal.set(originalUrl, `/friend-link-icons/${filename}`);
    console.log(`跳过（已存在）${filename}`);
    continue;
  }

  let succeeded = false;
  for (const fallbackUrl of fallbacks) {
    try {
      await downloadFile(fallbackUrl, destPath);
      urlToLocal.set(originalUrl, `/friend-link-icons/${filename}`);
      console.log(`OK     ${filename}  (via ${fallbackUrl})`);
      succeeded = true;
      break;
    } catch (err) {
      // 尝试下一个
    }
  }

  if (!succeeded) {
    stillFailed.push(originalUrl);
    console.error(`仍失败  ${filename}`);
  }
}

// 更新 ts 文件
let updated = content;
for (const [url, local] of urlToLocal) {
  updated = updated.replaceAll(`"icon": "${url}"`, `"icon": "${local}"`);
}
fs.writeFileSync(tsFile, updated, "utf8");

console.log(`\n补丁完成：新增 ${urlToLocal.size} 个图标。`);
if (stillFailed.length > 0) {
  console.log(`\n仍无法下载 (${stillFailed.length})：`);
  for (const u of stillFailed) console.log(`  ${u}`);
  console.log("这些 URL 保留远程地址，Tauri WebView 加载时应能正常显示。");
}
