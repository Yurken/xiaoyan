import { open } from "@tauri-apps/plugin-shell";

export const OFFICIAL_SITE_URL = "https://xiaoyan.net.cn/";

export function normalizeDoi(doi?: string | null): string | undefined {
  const value = doi?.trim();
  if (!value) return undefined;

  return value
    .replace(/^https?:\/\/doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim() || undefined;
}

export function buildDoiUrl(doi?: string | null): string | undefined {
  const normalized = normalizeDoi(doi);
  return normalized ? `https://doi.org/${normalized}` : undefined;
}

export function buildPaperSearchUrl(title?: string | null): string | undefined {
  const value = title?.trim();
  if (!value) return undefined;
  return `https://www.semanticscholar.org/search?q=${encodeURIComponent(value)}`;
}

export function buildPaperUrl(input: {
  title?: string | null;
  doi?: string | null;
  href?: string | null;
}): string | undefined {
  return input.href?.trim() || buildDoiUrl(input.doi) || buildPaperSearchUrl(input.title);
}

export async function openLink(url?: string | null) {
  const value = url?.trim();
  if (!value) return;
  await open(value);
}
