import type { DocumentInspection } from "./shared";

interface ZipEntry { compression: number; compressedSize: number; localOffset: number }

function findEndOfCentralDirectory(view: DataView) {
  for (let offset = view.byteLength - 22; offset >= Math.max(0, view.byteLength - 65_557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error("DOCX 压缩目录无效或文件已损坏。");
}

function readZipDirectory(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = findEndOfCentralDirectory(view);
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const entries = new Map<string, ZipEntry>();
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const compression = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + fileNameLength));
    entries.set(name, { compression, compressedSize, localOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

async function unzipText(bytes: Uint8Array, entries: Map<string, ZipEntry>, name: string) {
  const entry = entries.get(name);
  if (!entry) return "";
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fileNameLength = view.getUint16(entry.localOffset + 26, true);
  const extraLength = view.getUint16(entry.localOffset + 28, true);
  const start = entry.localOffset + 30 + fileNameLength + extraLength;
  const compressed = bytes.slice(start, start + entry.compressedSize);
  if (entry.compression === 0) return new TextDecoder().decode(compressed);
  if (entry.compression !== 8 || typeof DecompressionStream === "undefined") throw new Error("当前系统无法解压该 DOCX，请先另存为标准 DOCX 或 PDF。 ");
  const stream = new Blob([compressed.buffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

function parseXml(value: string) {
  if (!value) return null;
  const document = new DOMParser().parseFromString(value, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("DOCX 中的 XML 内容无法解析。");
  return document;
}

function elements(document: Document | Element | null, name: string): Element[] {
  if (!document) return [];
  return [...document.getElementsByTagName("*")].filter((element) => element.localName === name);
}

function attr(element: Element | undefined, name: string) {
  if (!element) return "";
  return [...element.attributes].find((attribute) => attribute.localName === name)?.value ?? "";
}

function twips(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed * 25.4 / 1440 : null;
}

function halfPoints(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed / 2 : null;
}

export async function inspectDocx(bytes: Uint8Array, fileName: string): Promise<DocumentInspection> {
  const entries = readZipDirectory(bytes);
  const [documentXml, stylesXml, appXml] = await Promise.all([
    unzipText(bytes, entries, "word/document.xml"),
    unzipText(bytes, entries, "word/styles.xml"),
    unzipText(bytes, entries, "docProps/app.xml"),
  ]);
  const document = parseXml(documentXml);
  const styles = parseXml(stylesXml);
  const app = parseXml(appXml);
  if (!document) throw new Error("DOCX 中未找到正文。");

  const paragraphs = elements(document, "p").map((paragraph) => elements(paragraph, "t").map((node) => node.textContent ?? "").join(""));
  const text = paragraphs.join("\n");
  const section = elements(document, "sectPr").at(-1);
  const pageSize = elements(section ?? null, "pgSz")[0];
  const pageMargin = elements(section ?? null, "pgMar")[0];
  const width = twips(attr(pageSize, "w"));
  const height = twips(attr(pageSize, "h"));
  const margins = ["top", "right", "bottom", "left"].map((name) => twips(attr(pageMargin, name)));
  const [marginTop, marginRight, marginBottom, marginLeft] = margins;

  const normalStyle = elements(styles, "style").find((style) => attr(style, "styleId") === "Normal");
  const defaultProperties = elements(styles, "rPrDefault")[0];
  const fontElements = [...elements(normalStyle ?? null, "rFonts"), ...elements(defaultProperties ?? null, "rFonts"), ...elements(document, "rFonts")];
  const fonts = new Set(fontElements.flatMap((font) => [attr(font, "eastAsia"), attr(font, "ascii"), attr(font, "hAnsi")]).filter(Boolean));
  const normalSizes = [...elements(normalStyle ?? null, "sz"), ...elements(defaultProperties ?? null, "sz")].map((node) => halfPoints(attr(node, "val"))).filter((value): value is number => value !== null);
  const allSizes = elements(document, "sz").map((node) => halfPoints(attr(node, "val"))).filter((value): value is number => value !== null);
  const pageCountText = elements(app, "Pages")[0]?.textContent ?? "";
  const pageCount = Number(pageCountText) || null;
  const pageFields = elements(document, "instrText").some((node) => /\bPAGE\b/i.test(node.textContent ?? ""));

  return {
    fileName,
    fileType: "docx",
    pageCount,
    pageWidthMm: width,
    pageHeightMm: height,
    marginsMm: marginTop !== null && marginRight !== null && marginBottom !== null && marginLeft !== null
      ? { top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft }
      : null,
    fonts: [...fonts],
    fontSizesPt: [...new Set([...normalSizes, ...allSizes])].sort((a, b) => a - b),
    text,
    pageNumbers: pageFields ? [1] : [],
    blankPages: [],
    hasComments: entries.has("word/comments.xml") || entries.has("word/commentsExtended.xml"),
    hasRevisions: elements(document, "ins").length > 0 || elements(document, "del").length > 0,
  };
}
