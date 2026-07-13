import type { WritingEditorSource, WritingTexFile } from "./shared";

const TEX_SOURCE_PREFIX = "tex:";

export function normalizeWritingTexFilePath(value: string): string | null {
  const normalized = value.trim().replace(/\\/g, "/").replace(/^\.\/+/, "");
  if (!normalized || normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized)) return null;

  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null;

  const path = normalized.toLowerCase().endsWith(".tex") ? normalized : `${normalized}.tex`;
  if (path === "main.tex" || !path.toLowerCase().endsWith(".tex")) return null;
  return path;
}

export function writingTexFileSource(path: string): WritingEditorSource {
  return `${TEX_SOURCE_PREFIX}${path}`;
}

export function writingTexFilePathFromSource(source: WritingEditorSource): string | null {
  if (!source.startsWith(TEX_SOURCE_PREFIX)) return null;
  return normalizeWritingTexFilePath(source.slice(TEX_SOURCE_PREFIX.length));
}

export function normalizeWritingTexFiles(files: WritingTexFile[]): WritingTexFile[] {
  const seen = new Set<string>();
  return files.flatMap((file) => {
    const path = normalizeWritingTexFilePath(file.path);
    if (!path || seen.has(path)) return [];
    seen.add(path);
    return [{ path, content: typeof file.content === "string" ? file.content : "" }];
  });
}

export function findWritingTexFile(files: WritingTexFile[], source: WritingEditorSource): WritingTexFile | undefined {
  const path = writingTexFilePathFromSource(source);
  return path ? files.find((file) => file.path === path) : undefined;
}

export function resolveWritingProjectSource(mainTex: string, texFiles: WritingTexFile[]): string {
  const fileMap = new Map(normalizeWritingTexFiles(texFiles).map((file) => [file.path, file.content]));
  return expandIncludes(mainTex, fileMap, new Set());
}

function expandIncludes(source: string, fileMap: Map<string, string>, ancestors: Set<string>): string {
  return source.replace(/\\(?:input|include)\s*\{([^}]+)\}/g, (match, reference: string) => {
    const path = resolveTexReference(reference);
    const content = path ? fileMap.get(path) : undefined;
    if (!path || content === undefined || ancestors.has(path)) return match;

    const nextAncestors = new Set(ancestors);
    nextAncestors.add(path);
    return `\n% --- begin ${path} ---\n${expandIncludes(content, fileMap, nextAncestors)}\n% --- end ${path} ---`;
  });
}

function resolveTexReference(reference: string): string | null {
  return normalizeWritingTexFilePath(reference);
}
