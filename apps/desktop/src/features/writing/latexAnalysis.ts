import type { LatexDiagnostic, LatexOutlineEntry, LatexPreviewBlock, LatexStats } from "./shared";

const SECTION_LEVEL: Record<string, number> = {
  section: 1,
  subsection: 2,
  subsubsection: 3,
  paragraph: 4,
};

export function extractLatexOutline(source: string): LatexOutlineEntry[] {
  const entries: LatexOutlineEntry[] = [];
  const sectionRegex = /^\\(section|subsection|subsubsection|paragraph)\*?\{([^}]*)\}/gm;
  let match: RegExpExecArray | null;

  while ((match = sectionRegex.exec(source))) {
    const command = match[1];
    const title = cleanLatexInline(match[2] || "未命名章节") || "未命名章节";
    const line = source.slice(0, match.index).split("\n").length;
    entries.push({
      id: `${command}-${line}-${entries.length}`,
      title,
      level: SECTION_LEVEL[command] ?? 1,
      line,
      command,
    });
  }

  return entries;
}

export function getLatexStats(source: string): LatexStats {
  const withoutComments = stripLatexComments(source);
  const text = withoutComments
    .replace(/\\begin\{equation\}[\s\S]*?\\end\{equation\}/g, " ")
    .replace(/\$[^$]*\$/g, " ")
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{([^}]*)\})?/g, " $1 ")
    .replace(/[{}\\]/g, " ");
  const englishWords = text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) ?? [];
  const cjkWords = text.match(/[\u3400-\u9fff]/g) ?? [];
  const equations = (withoutComments.match(/\\begin\{equation\}|\\\[|\$\$/g) ?? []).length;
  const citations = getCitationKeys(source).length;
  const labels = getLabelKeys(source).length;

  return {
    lines: source.split("\n").length,
    characters: source.length,
    words: englishWords.length + cjkWords.length,
    equations,
    citations,
    labels,
  };
}

export function analyzeLatex(source: string, bibtex: string): LatexDiagnostic[] {
  const diagnostics: LatexDiagnostic[] = [];
  const withoutComments = stripLatexComments(source);

  if (!/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/.test(withoutComments)) {
    diagnostics.push({
      id: "missing-documentclass",
      severity: "error",
      title: "缺少 documentclass",
      detail: "项目包需要从 main.tex 根文件编译，请补上 \\documentclass。",
      line: 1,
    });
  }

  const beginDocument = withoutComments.match(/\\begin\{document\}/);
  const endDocument = withoutComments.match(/\\end\{document\}/);
  if (!beginDocument || !endDocument) {
    diagnostics.push({
      id: "missing-document-env",
      severity: "error",
      title: "缺少 document 环境",
      detail: "正文需要包在 \\begin{document} 与 \\end{document} 之间。",
    });
  }

  const braceBalance = getBraceBalance(withoutComments);
  if (braceBalance !== 0) {
    diagnostics.push({
      id: "brace-balance",
      severity: "warning",
      title: braceBalance > 0 ? "可能有未闭合的大括号" : "可能有多余的大括号",
      detail: `当前大括号净差为 ${braceBalance}，建议检查最近插入的命令或环境。`,
    });
  }

  diagnostics.push(...analyzeEnvironments(withoutComments));
  diagnostics.push(...analyzeLabelsAndRefs(withoutComments));
  diagnostics.push(...analyzeCitations(withoutComments, bibtex));

  if (!/\\bibliography\{[^}]+\}/.test(withoutComments)) {
    diagnostics.push({
      id: "missing-bibliography",
      severity: "info",
      title: "尚未连接 BibTeX",
      detail: "如果需要参考文献，请保留 \\bibliography{references}，导出的 zip 会包含 references.bib。",
    });
  }

  return diagnostics;
}

export function buildLatexPreviewBlocks(source: string): LatexPreviewBlock[] {
  const withoutComments = stripLatexComments(source);
  const blocks: LatexPreviewBlock[] = [];
  const title = matchLatexCommand(withoutComments, "title");
  const author = matchLatexCommand(withoutComments, "author");

  if (title || author) {
    blocks.push({
      id: "meta",
      kind: "meta",
      title: title ? cleanLatexInline(title) : "未命名论文",
      content: author ? cleanLatexInline(author.replace(/\\and/g, "、")) : "作者待补充",
      level: 0,
    });
  }

  const abstract = withoutComments.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);
  if (abstract?.[1]?.trim()) {
    blocks.push({
      id: "abstract",
      kind: "abstract",
      title: "摘要",
      content: cleanLatexBlock(abstract[1]),
      level: 1,
    });
  }

  const outline = extractLatexOutline(withoutComments);
  if (outline.length === 0) {
    const body = withoutComments.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/)?.[1] ?? withoutComments;
    blocks.push({
      id: "body",
      kind: "body",
      title: "正文预览",
      content: cleanLatexBlock(body),
      level: 1,
    });
    return blocks;
  }

  for (let index = 0; index < outline.length; index += 1) {
    const current = outline[index];
    const next = outline[index + 1];
    const currentLineStart = getLineStartIndex(withoutComments, current.line);
    const nextLineStart = next ? getLineStartIndex(withoutComments, next.line) : withoutComments.length;
    const rawSection = withoutComments.slice(currentLineStart, nextLineStart);
    const body = rawSection.replace(/^\\(section|subsection|subsubsection|paragraph)\*?\{[^}]*\}/, "");
    blocks.push({
      id: current.id,
      kind: "section",
      title: current.title,
      content: cleanLatexBlock(body),
      level: current.level,
    });
  }

  return blocks;
}

function stripLatexComments(source: string): string {
  return source
    .split("\n")
    .map((line) => {
      let escaped = false;
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === "\\" && !escaped) {
          escaped = true;
          continue;
        }
        if (char === "%" && !escaped) {
          return line.slice(0, index);
        }
        escaped = false;
      }
      return line;
    })
    .join("\n");
}

function cleanLatexInline(value: string): string {
  return value
    .replace(/\\and/g, "、")
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?\{([^}]*)\}/g, "$1")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLatexBlock(value: string): string {
  return value
    .replace(/\\begin\{equation\}[\s\S]*?\\end\{equation\}/g, "[公式]")
    .replace(/\\begin\{table\}[\s\S]*?\\end\{table\}/g, "[表格]")
    .replace(/\\begin\{figure\}[\s\S]*?\\end\{figure\}/g, "[图片]")
    .replace(/\\cite[a-zA-Z]*\*?(?:\[[^\]]*\])*\{([^}]*)\}/g, "[$1]")
    .replace(/\\ref\{([^}]*)\}/g, "$1")
    .replace(/\\label\{[^}]*\}/g, "")
    .replace(/\\(begin|end)\{[^}]+\}/g, "")
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?\{([^}]*)\}/g, "$1")
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/[{}]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function matchLatexCommand(source: string, command: string): string {
  return source.match(new RegExp(`\\\\${command}(?:\\[[^\\]]*\\])?\\{([^}]*)\\}`))?.[1] ?? "";
}

function getLineStartIndex(source: string, line: number): number {
  if (line <= 1) return 0;
  let currentLine = 1;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") {
      currentLine += 1;
      if (currentLine === line) return index + 1;
    }
  }
  return source.length;
}

function getBraceBalance(source: string): number {
  let balance = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const previous = source[index - 1];
    if (previous === "\\") continue;
    if (char === "{") balance += 1;
    if (char === "}") balance -= 1;
  }
  return balance;
}

function analyzeEnvironments(source: string): LatexDiagnostic[] {
  const diagnostics: LatexDiagnostic[] = [];
  const stack: Array<{ name: string; line: number }> = [];
  const regex = /\\(begin|end)\{([^}]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(source))) {
    const action = match[1];
    const name = match[2];
    const line = source.slice(0, match.index).split("\n").length;
    if (action === "begin") {
      stack.push({ name, line });
      continue;
    }
    const previous = stack.pop();
    if (!previous || previous.name !== name) {
      diagnostics.push({
        id: `env-mismatch-${line}-${name}`,
        severity: "error",
        title: "环境闭合不匹配",
        detail: `第 ${line} 行的 \\end{${name}} 没有匹配的 \\begin{${name}}。`,
        line,
      });
    }
  }

  for (const item of stack) {
    diagnostics.push({
      id: `env-unclosed-${item.line}-${item.name}`,
      severity: "error",
      title: "环境未闭合",
      detail: `第 ${item.line} 行的 \\begin{${item.name}} 需要对应的 \\end{${item.name}}。`,
      line: item.line,
    });
  }

  return diagnostics;
}

function analyzeLabelsAndRefs(source: string): LatexDiagnostic[] {
  const diagnostics: LatexDiagnostic[] = [];
  const labels = getLabelKeys(source);
  const refs = getRefKeys(source);
  const labelCounts = new Map<string, number>();

  for (const label of labels) {
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }

  for (const [label, count] of labelCounts) {
    if (count > 1) {
      diagnostics.push({
        id: `label-duplicate-${label}`,
        severity: "warning",
        title: "重复 label",
        detail: `label “${label}” 出现了 ${count} 次，交叉引用可能会跳错位置。`,
      });
    }
  }

  const labelSet = new Set(labels);
  for (const ref of refs) {
    if (!labelSet.has(ref)) {
      diagnostics.push({
        id: `ref-missing-${ref}`,
        severity: "warning",
        title: "引用了不存在的 label",
        detail: `\\ref{${ref}} 没有找到对应的 \\label{${ref}}。`,
      });
    }
  }

  return diagnostics;
}

function analyzeCitations(source: string, bibtex: string): LatexDiagnostic[] {
  const diagnostics: LatexDiagnostic[] = [];
  const citationKeys = getCitationKeys(source);
  const bibKeys = getBibtexKeys(bibtex);
  const bibKeySet = new Set(bibKeys);

  for (const key of citationKeys) {
    if (!bibKeySet.has(key)) {
      diagnostics.push({
        id: `citation-missing-${key}`,
        severity: "warning",
        title: "BibTeX 缺少引用条目",
        detail: `正文引用了 “${key}”，但 references.bib 中没有对应条目。`,
      });
    }
  }

  return diagnostics;
}

function getCitationKeys(source: string): string[] {
  const keys: string[] = [];
  const regex = /\\cite[a-zA-Z]*\*?(?:\[[^\]]*\])*\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source))) {
    const rawKeys = match[1].split(",").map((key) => key.trim()).filter(Boolean);
    keys.push(...rawKeys);
  }
  return [...new Set(keys)];
}

function getLabelKeys(source: string): string[] {
  return [...source.matchAll(/\\label\{([^}]+)\}/g)].map((match) => match[1].trim()).filter(Boolean);
}

function getRefKeys(source: string): string[] {
  return [...source.matchAll(/\\(?:ref|eqref|autoref|cref|Cref)\{([^}]+)\}/g)]
    .flatMap((match) => match[1].split(",").map((key) => key.trim()))
    .filter(Boolean);
}

function getBibtexKeys(bibtex: string): string[] {
  return [...bibtex.matchAll(/@\w+\s*\{\s*([^,\s]+)\s*,/g)].map((match) => match[1].trim()).filter(Boolean);
}
