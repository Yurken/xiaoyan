export const PAPER_TAG_OPTIONS = [
  { key: "ccf_rating", label: "CCF", description: "显示 CCF 等级标签" },
  { key: "ccf_type", label: "期刊/会议", description: "显示 CCF 识别出的来源类型" },
  { key: "wos_indexes", label: "WoS 收录", description: "显示 SCIE / SSCI / ESCI / AHCI 标签" },
  { key: "jcr_quartile", label: "JCR 分区", description: "显示 JCR Q1-Q4 标签" },
  { key: "cas_quartile", label: "中科院分区", description: "显示中科院 1-4 区标签" },
  { key: "cas_top", label: "Top", description: "显示中科院 Top 标签" },
] as const;

export type PaperTagVisibilityKey = (typeof PAPER_TAG_OPTIONS)[number]["key"];

export const DEFAULT_PAPER_TAG_VISIBILITY: PaperTagVisibilityKey[] = [
  "ccf_rating",
  "ccf_type",
  "wos_indexes",
  "jcr_quartile",
  "cas_quartile",
  "cas_top",
];

const VALID_KEYS = new Set<PaperTagVisibilityKey>(DEFAULT_PAPER_TAG_VISIBILITY);

export const DEFAULT_PAPER_TAG_VISIBILITY_VALUE = DEFAULT_PAPER_TAG_VISIBILITY.join(",");

export function parsePaperTagVisibility(raw?: string | null): Set<PaperTagVisibilityKey> {
  const selected = (raw || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is PaperTagVisibilityKey => VALID_KEYS.has(item as PaperTagVisibilityKey));

  return new Set(selected.length > 0 ? selected : DEFAULT_PAPER_TAG_VISIBILITY);
}

export function serializePaperTagVisibility(selected: Iterable<PaperTagVisibilityKey>): string {
  const selectedSet = new Set(selected);
  const ordered = DEFAULT_PAPER_TAG_VISIBILITY.filter((key) => selectedSet.has(key));
  return ordered.join(",");
}

export function togglePaperTagVisibility(
  current: string,
  key: PaperTagVisibilityKey,
): string {
  const next = parsePaperTagVisibility(current);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  return serializePaperTagVisibility(next);
}
