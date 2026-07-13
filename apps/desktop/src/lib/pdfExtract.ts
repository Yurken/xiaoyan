import * as pdfjsLib from "pdfjs-dist";

// 配置 worker（Vite 会正确解析 ?url 后缀）
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * 从本地 PDF 文件路径中提取全文文本（通过 Tauri fs plugin 读取）。
 * 返回各页文本拼接后的字符串，供多视角预审等功能使用。
 */
export async function extractTextFromPdf(filePath: string): Promise<string> {
  const { readFile } = await import("@tauri-apps/plugin-fs");
  const bytes = await readFile(filePath);

  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;

  const CONCURRENCY = 6;
  const pageTexts: string[] = new Array(pdf.numPages);
  for (let start = 0; start < pdf.numPages; start += CONCURRENCY) {
    const end = Math.min(start + CONCURRENCY, pdf.numPages);
    const batch = Array.from({ length: end - start }, async (_, j) => {
      const page = await pdf.getPage(start + j + 1);
      const content = await page.getTextContent();
      pageTexts[start + j] = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    });
    await Promise.all(batch);
  }

  return pageTexts.join("\n\n").trim();
}
