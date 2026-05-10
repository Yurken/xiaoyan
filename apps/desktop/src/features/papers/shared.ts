import type { Paper } from "@research-copilot/types";

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

export type PaperCitationFormat = "gbt7714" | "apa" | "mla" | "ieee" | "bibtex";

export const PAPER_CITATION_FORMATS: Array<{ value: PaperCitationFormat; label: string }> = [
  { value: "gbt7714", label: "GB/T 7714" },
  { value: "apa", label: "APA" },
  { value: "mla", label: "MLA" },
  { value: "ieee", label: "IEEE" },
  { value: "bibtex", label: "BibTeX" },
];

export function formatPaperCitation(paper: Paper, format: PaperCitationFormat): string {
  const title = cleanCitationPart(paper.title) || "Untitled";
  const authors = cleanCitationPart(paper.authors);
  const year = paper.year ? String(paper.year) : "";
  const venue = cleanCitationPart(paper.venue);
  const doi = cleanDoi(paper.doi);
  const doiUrl = doi ? `https://doi.org/${doi}` : "";

  if (format === "bibtex") {
    return formatBibTeX({ paper, title, authors, year, venue, doi });
  }

  if (format === "apa") {
    return [
      authors ? `${authors}.` : "",
      year ? `(${year}).` : "",
      `${title}.`,
      venue ? `${venue}.` : "",
      doiUrl,
    ].filter(Boolean).join(" ");
  }

  if (format === "mla") {
    return [
      authors ? `${authors}.` : "",
      `"${title}."`,
      venue ? `${venue},` : "",
      year ? `${year}.` : "",
      doi ? `doi:${doi}` : "",
    ].filter(Boolean).join(" ");
  }

  if (format === "ieee") {
    return [
      authors ? `${authors},` : "",
      `"${title},"`,
      venue ? `${venue},` : "",
      year ? `${year}.` : "",
      doi ? `doi: ${doi}` : "",
    ].filter(Boolean).join(" ");
  }

  const sourceMark = paper.ccf_type === "journal" || paper.journal_issn || paper.journal_eissn ? "J" : "C";
  return [
    authors ? `${authors}.` : "",
    `${title}[${sourceMark}].`,
    venue ? `${venue},` : "",
    year ? `${year}.` : "",
    doi ? `DOI:${doi}` : "",
  ].filter(Boolean).join(" ");
}

function formatBibTeX({
  paper,
  title,
  authors,
  year,
  venue,
  doi,
}: {
  paper: Paper;
  title: string;
  authors: string;
  year: string;
  venue: string;
  doi: string;
}) {
  const entryType = paper.ccf_type === "journal" || paper.journal_issn || paper.journal_eissn ? "article" : "inproceedings";
  const venueField = entryType === "article" ? "journal" : "booktitle";
  const fields = [
    ["title", title],
    ["author", authorsToBibTeX(authors)],
    [venueField, venue],
    ["year", year],
    ["doi", doi],
  ].filter(([, value]) => value);

  const body = fields
    .map(([key, value]) => `  ${key} = {${escapeBibTeX(String(value))}}`)
    .join(",\n");

  return `@${entryType}{${makeBibTeXKey(paper, authors, year, title)},\n${body}\n}`;
}

function cleanCitationPart(value?: string | null) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanDoi(value?: string | null) {
  return cleanCitationPart(value)
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");
}

function authorsToBibTeX(authors: string) {
  if (!authors) return "";
  return authors
    .split(/\s*(?:,|;|；|，)\s*/)
    .map((author) => author.trim())
    .filter(Boolean)
    .join(" and ");
}

function makeBibTeXKey(paper: Paper, authors: string, year: string, title: string) {
  const firstAuthor = authors
    .split(/\s*(?:,|;|；|，)\s*/)
    .find(Boolean)
    ?.split(/\s+/)
    .at(-1) ?? "paper";
  const firstTitleWord = title.match(/[A-Za-z0-9]+/)?.[0] ?? paper.id.slice(0, 6);
  return `${firstAuthor}${year || "nd"}${firstTitleWord}`
    .replace(/[^A-Za-z0-9_:-]/g, "")
    .slice(0, 64);
}

function escapeBibTeX(value: string) {
  return value.replace(/[{}]/g, "");
}
