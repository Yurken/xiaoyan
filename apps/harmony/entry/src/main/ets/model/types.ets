/**
 * 跨端类型在 ArkTS 侧的镜像。
 *
 * 注意：HarmonyOS 模块系统无法直接消费 workspace 包 @research-copilot/types（TS 源 + 路径别名）。
 * 这里只镜像「已桥接到原生后端」的结构，字段名与 Rust serde 输出严格一致（snake_case）。
 * 后续每桥接一个命令，就在此补齐对应类型，作为单一事实来源。
 */

/** 刊会查询条目，镜像 services::source_service::SourceLookupItem。 */
export interface SourceLookupItem {
  source: string;
  entity_type: string | null;
  name: string;
  url: string | null;
  publisher: string | null;
  rating: string | null;
  area: string | null;
  label: string | null;
  issn: string | null;
  eissn: string | null;
  indexes: string[];
  wos_categories: string[];
  jcr_quartile: string | null;
  jcr_category: string | null;
  jif: string | null;
  jif_rank: string | null;
  cas_quartile: string | null;
  cas_top: boolean | null;
  open_access: boolean | null;
}

/** 刊会查询分区（期刊分区 / CCF 评级）。 */
export interface SourceLookupSection {
  key: string;
  title: string;
  items: SourceLookupItem[];
}

export interface SourceLookupResponse {
  query: string;
  sections: SourceLookupSection[];
}

/** CCF 评级条目，镜像 ccf::CcfTag。 */
export interface CcfMatch {
  kind: string;
  rating: string;
  area: string;
  label: string;
  full_name: string;
  publisher: string;
  url: string;
}
