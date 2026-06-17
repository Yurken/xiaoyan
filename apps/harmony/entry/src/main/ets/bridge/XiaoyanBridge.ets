/**
 * 桌面端 client.ts 在 HarmonyOS 侧的对应实现。
 *
 * 桌面端经由 Tauri invoke() 调 Rust 命令；这里经由 NAPI 直接调用同一套 Rust 逻辑。
 * 已桥接的命令走原生（刊会查询 / CCF / 期刊分区）；未桥接的命令统一抛出可读错误，
 * 由各 feature 的 ViewModel 捕获并展示「尚未桥接」提示，保证 UI 不崩。
 */
import { sourceLookup, ccfLookup, journalRankFilter } from './native';
import { SourceLookupResponse, CcfMatch } from '../model/types';

/** 归一化错误信息，对齐 client.ts 的 formatErrorMessage 行为。 */
export function formatErrorMessage(error: Object | null | undefined): string {
  const raw: string = error instanceof Error ? error.message : String(error ?? '');
  const normalized: string = raw.trim();
  if (normalized.length === 0) {
    return '操作未完成，请稍后重试。';
  }
  return normalized;
}

/** 刊会综合查询（期刊分区 + CCF），已端到端桥接到原生后端。 */
export class SourceApi {
  static lookup(query: string, limit: number = 8): SourceLookupResponse {
    const raw: string = sourceLookup(query, limit);
    return JSON.parse(raw) as SourceLookupResponse;
  }
}

/** CCF 评级查询，已桥接。 */
export class CcfApi {
  static lookup(query: string, limit: number = 8): CcfMatch[] {
    const raw: string = ccfLookup(query, limit);
    const parsed: Record<string, Object> = JSON.parse(raw) as Record<string, Object>;
    return parsed.matches as CcfMatch[];
  }
}

/** 期刊分区查询 / 按 WoS 分类与等级过滤，已桥接。 */
export class JournalApi {
  static rankFilter(wosCatKeywords: string[], ranks: string[]): string[] {
    return journalRankFilter(wosCatKeywords, ranks);
  }
}

/**
 * 未桥接命令的通用占位入口。
 * 对齐 client.ts 的 invoke 形态；当前一律抛错，待 Rust 后端解耦后逐个接通。
 */
export class XiaoyanBridge {
  static invoke<T>(command: string, _args?: Record<string, Object>): Promise<T> {
    return Promise.reject(
      new Error(`命令 “${command}” 尚未桥接到 HarmonyOS 原生后端（详见 apps/harmony/README.md 解耦路线）。`),
    );
  }
}
