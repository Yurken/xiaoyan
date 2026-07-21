export interface ReaderOutlineEntry {
  id: string;
  title: string;
  page: number;
  depth: number;
}

export interface ReaderPageContent {
  page: number;
  text: string;
  lines: string[];
  lineDetails?: ReaderPageLine[];
}

export interface ReaderPageLine {
  text: string;
  fontSize: number;
}

export interface ReaderSearchResult {
  page: number;
  snippet: string;
  score: number;
}

const SECTION_NUMBER_PREFIX = String.raw`(?:\d+(?:\.\d+){0,3})\.?`;
const ENGLISH_HEADING_PATTERN = new RegExp(`^(?:${SECTION_NUMBER_PREFIX}\\s+)?(?:abstract|introduction|background|related work|method(?:ology)?|approach|experiments?|results?|discussion|limitations?|conclusions?|references)\\b`, "i");
const CHINESE_HEADING_PATTERN = new RegExp(`^(?:${SECTION_NUMBER_PREFIX}\\s+)?(?:摘要|引言|背景|相关工作|方法|实验|结果|讨论|局限|结论|参考文献)`);
const NUMBERED_HEADING_PATTERN = /^(\d+(?:\.\d+){0,3})\.?\s+(.{2,72})$/u;
const FORMULA_PATTERN = /[=+*/<>∑∫√{}\[\];]/;
const CODE_STATEMENT_PATTERN = /^(?:def|return|import)\b|\bfrom\s+\S+\s+import\b|:\s*(?:int|float|bool)\b/i;

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function isStandardHeading(title: string) {
  return ENGLISH_HEADING_PATTERN.test(title) || CHINESE_HEADING_PATTERN.test(title);
}

function isPlausibleNumberedHeading(title: string, fontSize: number, bodyFontSize: number) {
  const match = title.match(NUMBERED_HEADING_PATTERN);
  if (!match) return false;
  const headingText = match[2].trim();
  if (FORMULA_PATTERN.test(headingText) || CODE_STATEMENT_PATTERN.test(headingText) || /[,.;:：]$/.test(headingText)) return false;
  if (headingText.split(/\s+/).length > 10) return false;
  const firstLetter = headingText.match(/\p{L}/u)?.[0];
  if (!firstLetter) return false;
  const isCasedLetter = firstLetter.toLocaleLowerCase() !== firstLetter.toLocaleUpperCase();
  if (isCasedLetter && firstLetter !== firstLetter.toLocaleUpperCase()) return false;
  return bodyFontSize <= 0 || fontSize <= 0 || fontSize >= bodyFontSize * 1.06;
}

export function deriveOutlineFromPages(pages: ReaderPageContent[]): ReaderOutlineEntry[] {
  const entries: ReaderOutlineEntry[] = [];
  const seen = new Set<string>();
  const bodyFontSize = median(pages.flatMap((page) => (
    page.lineDetails ?? []
  )).filter((line) => line.text.length >= 12 && line.fontSize > 0).map((line) => line.fontSize));
  for (const page of pages) {
    const candidates = page.lineDetails?.length
      ? page.lineDetails.slice(0, 50)
      : page.lines.slice(0, 50).map((text) => ({ text, fontSize: 0 }));
    for (const line of candidates) {
      const title = line.text.replace(/\s+/g, " ").trim();
      if (title.length < 3 || title.length > 96) continue;
      if (!isStandardHeading(title) && !isPlausibleNumberedHeading(title, line.fontSize, bodyFontSize)) continue;
      const key = title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const number = title.match(/^(\d+(?:\.\d+)*)/)?.[1];
      entries.push({
        id: `derived-${page.page}-${entries.length}`,
        title,
        page: page.page,
        depth: number ? Math.max(0, number.split(".").length - 1) : 0,
      });
    }
  }
  return entries;
}

/** PDF 自带目录只有零散条目时，用版式推断结果补齐，而不是把“仅 Abstract”当作完整目录。 */
export function supplementSparseOutline(
  nativeOutline: ReaderOutlineEntry[],
  derivedOutline: ReaderOutlineEntry[],
) {
  if (nativeOutline.length > 1) return nativeOutline;
  const result = [...nativeOutline];
  const seen = new Set(nativeOutline.map((entry) => `${entry.page}:${entry.title.replace(/\s+/g, " ").trim().toLocaleLowerCase()}`));
  for (const entry of derivedOutline) {
    const key = `${entry.page}:${entry.title.replace(/\s+/g, " ").trim().toLocaleLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result.sort((a, b) => a.page - b.page);
}

function normalizedQueryParts(query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return { normalized, tokens: tokens.length > 0 ? tokens : [normalized] };
}

export function searchReaderPages(pages: ReaderPageContent[], query: string): ReaderSearchResult[] {
  const { normalized, tokens } = normalizedQueryParts(query);
  if (!normalized) return [];

  return pages
    .map((page) => {
      const lower = page.text.toLocaleLowerCase();
      let score = 0;
      let firstIndex = lower.indexOf(normalized);
      if (firstIndex >= 0) score += 8;
      for (const token of tokens) {
        let index = lower.indexOf(token);
        if (index >= 0 && firstIndex < 0) firstIndex = index;
        while (index >= 0) {
          score += 1;
          index = lower.indexOf(token, index + token.length);
        }
      }
      if (score === 0 || firstIndex < 0) return null;
      const start = Math.max(0, firstIndex - 72);
      const end = Math.min(page.text.length, firstIndex + normalized.length + 120);
      const snippet = `${start > 0 ? "…" : ""}${page.text.slice(start, end).replace(/\s+/g, " ").trim()}${end < page.text.length ? "…" : ""}`;
      return { page: page.page, snippet, score };
    })
    .filter((result): result is ReaderSearchResult => result !== null)
    .sort((a, b) => b.score - a.score || a.page - b.page)
    .slice(0, 100);
}

export function buildReaderQuestionContext(
  pages: ReaderPageContent[],
  question: string,
  currentPage: number,
  maxChars = 14_000,
) {
  const { normalized, tokens } = normalizedQueryParts(question);
  const ranked = pages
    .map((page) => {
      const lower = page.text.toLocaleLowerCase();
      let score = page.page === currentPage ? 4 : 0;
      if (normalized && lower.includes(normalized)) score += 10;
      for (const token of tokens) if (token && lower.includes(token)) score += 2;
      return { page, score };
    })
    .sort((a, b) => b.score - a.score || Math.abs(a.page.page - currentPage) - Math.abs(b.page.page - currentPage));

  let context = "";
  for (const item of ranked) {
    if (!item.page.text.trim()) continue;
    const block = `\n\n[第 ${item.page.page} 页]\n${item.page.text.trim()}`;
    if (context.length + block.length > maxChars) {
      const remaining = maxChars - context.length;
      if (remaining > 200) context += block.slice(0, remaining);
      break;
    }
    context += block;
    if (context.length >= maxChars) break;
  }
  return context.trim();
}
