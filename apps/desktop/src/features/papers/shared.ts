export type PaperFigure = {
  id: string;
  fig_index: number;
  caption: string | null;
  data_url: string;
};

export function findReferencedFigures(text: string, figures: PaperFigure[]): PaperFigure[] {
  if (!figures.length || !text) return [];

  const refs = new Set<number>();
  const patterns = [
    /\bfig(?:ure)?\.?\s*(\d+)/gi,
    /\b图\s*(\d+)/g,
    /\btable\s*(\d+)/gi,
    /\b表\s*(\d+)/g,
  ];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      refs.add(parseInt(match[1], 10));
    }
  }

  if (!refs.size) return [];

  const result: PaperFigure[] = [];
  const usedIds = new Set<string>();

  for (const ref of refs) {
    const byCaption = figures.find((figure) => {
      if (!figure.caption || usedIds.has(figure.id)) return false;
      const caption = figure.caption.toLowerCase();
      return [
        `figure ${ref}`,
        `fig. ${ref}`,
        `fig ${ref}`,
        `table ${ref}`,
        `图${ref}`,
        `表${ref}`,
      ].some((needle) => caption.includes(needle));
    });
    const matched = byCaption ?? figures.find((figure) => figure.fig_index === ref && !usedIds.has(figure.id));
    if (matched) {
      usedIds.add(matched.id);
      result.push(matched);
    }
  }

  return result;
}
