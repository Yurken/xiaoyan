export interface VisualBibliographyEntry {
  key: string;
  title: string;
}

export function extractVisualBibliographyEntries(source: string): VisualBibliographyEntry[] {
  const entries: VisualBibliographyEntry[] = [];
  const pattern = /@\w+\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    const open = match.index + match[0].length - 1;
    const end = findEntryEnd(source, open);
    if (end < 0) continue;
    const body = source.slice(open + 1, end - 1);
    const comma = body.indexOf(",");
    const key = (comma < 0 ? body : body.slice(0, comma)).trim();
    if (key) entries.push({ key, title: comma < 0 ? "" : readTitle(body.slice(comma + 1)) });
    pattern.lastIndex = end;
  }
  return entries;
}

export function extractVisualReferenceLabels(source: string): string[] {
  return [...source.matchAll(/\\label\s*\{([^}]+)\}/g)].map((match) => match[1].trim()).filter(Boolean);
}

function findEntryEnd(source: string, open: number): number {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (isEscaped(source, index)) continue;
    if (source[index] === "{") depth += 1;
    if (source[index] !== "}") continue;
    depth -= 1;
    if (depth === 0) return index + 1;
  }
  return -1;
}

function readTitle(body: string): string {
  const match = /(?:^|\n)\s*title\s*=\s*/i.exec(body);
  if (!match || match.index === undefined) return "";
  const start = match.index + match[0].length;
  if (body[start] === "{") {
    const end = findEntryEnd(body, start);
    return end < 0 ? "" : cleanTitle(body.slice(start + 1, end - 1));
  }
  if (body[start] === '"') {
    const end = body.indexOf('"', start + 1);
    return end < 0 ? "" : cleanTitle(body.slice(start + 1, end));
  }
  return cleanTitle(body.slice(start).split(/[,\n]/)[0]);
}

function cleanTitle(value: string): string {
  return value.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}

function isEscaped(source: string, index: number): boolean {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) slashes += 1;
  return slashes % 2 === 1;
}
