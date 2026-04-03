import * as pdfjsLib from "pdfjs-dist";

// 配置 worker（Vite 会正确解析 ?url 后缀）
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * 从本地 PDF 文件路径中提取全文文本（通过 Tauri fs plugin 读取）。
 * 返回各页文本拼接后的字符串，供模拟审稿等功能使用。
 */
export async function extractTextFromPdf(filePath: string): Promise<string> {
  const { readFile } = await import("@tauri-apps/plugin-fs");
  const bytes = await readFile(filePath);

  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;

  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pageTexts.push(pageText);
  }

  return pageTexts.join("\n\n").trim();
}
