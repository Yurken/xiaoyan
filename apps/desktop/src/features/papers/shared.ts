export type PaperFigure = {
  id: string;
  fig_index: number;
  kind?: "figure" | "table" | string;
  caption: string | null;
  data_url: string;
};

type FigureReferenceKind = "figure" | "table";

type FigureReference = {
  kind: FigureReferenceKind;
  index: number;
  offset: number;
};

export function findReferencedFigures(text: string, figures: PaperFigure[]): PaperFigure[] {
  if (!figures.length || !text) return [];

  const refs = extractFigureReferences(text);
  if (!refs.length) return [];

  const result: PaperFigure[] = [];
  const usedIds = new Set<string>();

  for (const ref of refs) {
    const matched = figures.find((figure) => figureMatchesReference(figure, ref, usedIds));
    if (matched) {
      usedIds.add(matched.id);
      result.push(matched);
    }
  }

  return result;
}

function extractFigureReferences(text: string): FigureReference[] {
  const refs: FigureReference[] = [];
  const patterns: Array<{ kind: FigureReferenceKind; regex: RegExp }> = [
    { kind: "figure", regex: /\bfig(?:ure)?s?\.?\s*(\d{1,3})(?:\s*[a-z])?/gi },
    { kind: "figure", regex: /图\s*(\d{1,3})/g },
    { kind: "table", regex: /\btab(?:le)?s?\.?\s*(\d{1,3})(?:\s*[a-z])?/gi },
    { kind: "table", regex: /表\s*(\d{1,3})/g },
  ];

  for (const { kind, regex } of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const index = Number.parseInt(match[1], 10);
      if (Number.isFinite(index) && index > 0) {
        refs.push({ kind, index, offset: match.index });
      }
    }
  }

  return refs
    .sort((left, right) => left.offset - right.offset)
    .filter((ref, index, all) => {
      const previous = all[index - 1];
      return !previous || previous.kind !== ref.kind || previous.index !== ref.index;
    });
}

function figureMatchesReference(figure: PaperFigure, ref: FigureReference, usedIds: Set<string>) {
  if (usedIds.has(figure.id)) return false;
  const kind = normalizeFigureKind(figure.kind);
  if (kind && kind !== ref.kind) return false;
  if (figure.fig_index === ref.index) return true;

  if (!figure.caption) return false;
  const caption = normalizeCaption(figure.caption);
  if (ref.kind === "figure") {
    return [`figure ${ref.index}`, `fig ${ref.index}`, `图${ref.index}`].some((needle) => caption.includes(needle));
  }
  return [`table ${ref.index}`, `tab ${ref.index}`, `表${ref.index}`].some((needle) => caption.includes(needle));
}

function normalizeFigureKind(kind: PaperFigure["kind"]): FigureReferenceKind | null {
  if (!kind) return null;
  const normalized = kind.trim().toLowerCase();
  if (normalized === "figure" || normalized === "fig" || normalized === "图") return "figure";
  if (normalized === "table" || normalized === "tab" || normalized === "表") return "table";
  return null;
}

function normalizeCaption(caption: string) {
  return caption
    .toLowerCase()
    .replace(/\bfig\./g, "fig")
    .replace(/\btab\./g, "tab")
    .replace(/\s+/g, " ")
    .trim();
}
