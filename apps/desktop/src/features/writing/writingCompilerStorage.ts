import { WRITING_AUTO_COMPILE_ENABLED_KEY, type WritingCompileSummary } from "./shared";

const WRITING_COMPILE_RESULT_KEY = "rc:writing:compile:v1";

interface StoredCompileRecord {
  signature: string;
  summary: WritingCompileSummary;
}

export function compileResultStorageKey(draftId: string) {
  return `${WRITING_COMPILE_RESULT_KEY}:${draftId}`;
}

export function loadCompileRecord(storageKey: string): StoredCompileRecord | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && "summary" in parsed) {
      const record = parsed as StoredCompileRecord;
      return { signature: record.signature ?? "", summary: record.summary };
    }
    return { signature: "", summary: parsed as WritingCompileSummary };
  } catch {
    return null;
  }
}

export function saveCompileRecord(storageKey: string, record: StoredCompileRecord) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(record));
  } catch {
    // 存储不可用时仅保留内存态。
  }
}

export function loadAutoCompileEnabled(): boolean {
  try {
    const raw = localStorage.getItem(WRITING_AUTO_COMPILE_ENABLED_KEY);
    return raw === null || JSON.parse(raw) !== false;
  } catch {
    return true;
  }
}
