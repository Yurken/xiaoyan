/**
 * 刊会查询的纯逻辑层（feature 纯函数）。
 * 仅负责调用桥接 + 整形结果，不持有 UI 状态，便于复用与单测。
 */
import { SourceApi, formatErrorMessage } from '../../bridge/XiaoyanBridge';
import { SourceLookupSection } from '../../model/types';

export interface LookupOutcome {
  ok: boolean;
  sections: SourceLookupSection[];
  error: string;
}

/** 执行一次刊会查询；同步 NAPI 调用包进 Promise，对齐桌面端 async 客户端形态。 */
export async function runSourceLookup(query: string, limit: number = 10): Promise<LookupOutcome> {
  const trimmed: string = query.trim();
  if (trimmed.length === 0) {
    return { ok: true, sections: [], error: '' };
  }
  try {
    const result = SourceApi.lookup(trimmed, limit);
    const sections: SourceLookupSection[] = result.sections ?? [];
    return { ok: true, sections, error: '' };
  } catch (err) {
    return { ok: false, sections: [], error: formatErrorMessage(err as Object) };
  }
}

/** 按 key 取分区（journal_partition / ccf）。 */
export function pickSection(sections: SourceLookupSection[], key: string): SourceLookupSection | null {
  for (const section of sections) {
    if (section.key === key) {
      return section;
    }
  }
  return null;
}

/** 拼接副信息行（出版商 · ISSN · eISSN），过滤空值。 */
export function joinMeta(parts: (string | null)[]): string {
  const kept: string[] = [];
  for (const part of parts) {
    if (part !== null && part.trim().length > 0) {
      kept.push(part);
    }
  }
  return kept.join(' · ');
}
