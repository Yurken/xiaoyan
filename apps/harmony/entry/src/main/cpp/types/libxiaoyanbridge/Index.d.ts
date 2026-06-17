/**
 * libxiaoyanbridge.so 类型声明。
 *
 * 由 native/ (Rust + ohos-rs) 编译产出；函数名由 napi-rs 默认从 Rust 的
 * snake_case 转为 camelCase。已桥接：刊会 / CCF / 期刊分区查询。
 * 返回值多为 JSON 字符串，ArkTS 侧 JSON.parse 后按 model/types.ets 解释。
 */

/** 刊会综合查询（期刊分区 + CCF）→ SourceLookupResponse 的 JSON 字符串。 */
export function sourceLookup(query: string, limit: number): string;

/** CCF 评级查询 → { query, matches: CcfMatch[] } 的 JSON 字符串。 */
export function ccfLookup(query: string, limit: number): string;

/** 全部 CCF 收录刊会 → { venues: CcfMatch[] } 的 JSON 字符串。 */
export function ccfList(): string;

/** 期刊分区查询 → { query, matches: JournalPartitionTag[] } 的 JSON 字符串。 */
export function journalLookup(query: string, limit: number): string;

/** 按 WoS 分类关键词 + 等级过滤期刊标题（去重）。 */
export function journalRankFilter(wosCatKeywords: Array<string>, ranks: Array<string>): Array<string>;

/** 未桥接命令的统一占位入口，当前一律抛错。 */
export function invoke(command: string, argsJson: string): string;
