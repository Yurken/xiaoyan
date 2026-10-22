//! 角色模型配置解析：设置项 → 实际生效的 LLM 客户端。
//!
//! 小妍按任务划分出多个模型角色（对话、规划、视觉、嵌入……）。本模块集中定义
//! “一个角色如何解析成客户端”，避免同一套回退规则散落在各个调用点。
//!
//! 核心约定：**角色模型留空 = 完全继承主模型**。
//! 角色的 base_url / api_key / model 只有在三者都填写时才构成独立作用域；缺任意
//! 一项都回退主模型，绝不用硬编码模型名兜底——否则用户清空模型后，会静默换到他
//! 从未选择过的模型（历史行为是回落到 `deepseek-chat` / `claude-3-5-haiku`）。

use anyhow::{anyhow, Result};
use std::collections::HashMap;

use super::{
    is_anthropic_compatible_base_url, normalize_base_url, LlmClient, DEFAULT_ANTHROPIC_BASE_URL,
};

/// 读取设置项并去掉首尾空白；缺失或全为空白时返回空串，统一表示“未配置”。
fn setting_value<'a>(settings: &'a HashMap<String, String>, key: &str) -> &'a str {
    settings.get(key).map(|value| value.trim()).unwrap_or_default()
}

impl LlmClient {
    pub fn from_settings(s: &HashMap<String, String>) -> Result<Self> {
        let provider = s
            .get("llm_provider")
            .map(|v| v.as_str())
            .unwrap_or("openai");
        match provider {
            "anthropic" => {
                let api_key = s.get("anthropic_api_key").cloned().unwrap_or_default();
                if api_key.is_empty() {
                    return Err(anyhow!("Anthropic API key not configured"));
                }
                Ok(LlmClient::Anthropic {
                    base_url: DEFAULT_ANTHROPIC_BASE_URL.to_string(),
                    api_key,
                    chat_model: s
                        .get("anthropic_chat_model")
                        .cloned()
                        .unwrap_or_else(|| "claude-3-5-haiku-20241022".into()),
                })
            }
            "openai_compatible" => {
                let base_url = s
                    .get("openai_compatible_base_url")
                    .cloned()
                    .unwrap_or_default();
                if base_url.is_empty() {
                    return Err(anyhow!("OpenAI-compatible base URL not configured"));
                }
                let normalized_base_url = normalize_base_url(&base_url);
                let api_key = s
                    .get("openai_compatible_api_key")
                    .cloned()
                    .unwrap_or_default();
                if is_anthropic_compatible_base_url(&normalized_base_url) {
                    return Ok(LlmClient::Anthropic {
                        base_url: normalized_base_url,
                        api_key,
                        chat_model: s
                            .get("openai_compatible_chat_model")
                            .cloned()
                            .unwrap_or_else(|| "claude-3-5-haiku-20241022".into()),
                    });
                }
                Ok(LlmClient::OpenAI {
                    base_url: normalized_base_url,
                    api_key,
                    chat_model: s
                        .get("openai_compatible_chat_model")
                        .cloned()
                        .unwrap_or_else(|| "deepseek-chat".into()),
                    embed_model: s
                        .get("openai_compatible_embedding_model")
                        .cloned()
                        .unwrap_or_else(|| "BAAI/bge-m3".into()),
                })
            }
            _ => {
                // Default: openai
                let api_key = s.get("openai_api_key").cloned().unwrap_or_default();
                if api_key.is_empty() {
                    return Err(anyhow!("OpenAI API key not configured"));
                }
                Ok(LlmClient::OpenAI {
                    base_url: s
                        .get("openai_base_url")
                        .cloned()
                        .unwrap_or_else(|| "https://api.openai.com/v1".into()),
                    api_key,
                    chat_model: s
                        .get("openai_chat_model")
                        .cloned()
                        .unwrap_or_else(|| "gpt-4o-mini".into()),
                    embed_model: s
                        .get("openai_embedding_model")
                        .cloned()
                        .unwrap_or_else(|| "text-embedding-3-small".into()),
                })
            }
        }
    }

    /// Build a client specifically for vision tasks using the "视界" (vision) model settings.
    /// Falls back to the main LLM provider if vision-specific settings are not configured.
    pub fn vision_client_from_settings(
        s: &HashMap<String, String>,
    ) -> Option<(Self, Option<String>)> {
        let model = s
            .get("vision_model")
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty());
        let Some(model) = model else {
            return Self::from_settings(s).ok().map(|client| (client, None));
        };
        let base_url = s
            .get("vision_base_url")
            .map(|v| v.trim().to_string())
            .unwrap_or_default();
        let api_key = s
            .get("vision_api_key")
            .map(|v| v.trim().to_string())
            .unwrap_or_default();

        let client = if !base_url.is_empty() && !api_key.is_empty() {
            let normalized_base_url = normalize_base_url(&base_url);
            if is_anthropic_compatible_base_url(&normalized_base_url) {
                // Anthropic-compatible endpoint (e.g. Kimi Coding)
                LlmClient::Anthropic {
                    base_url: normalized_base_url,
                    api_key,
                    chat_model: model.clone(),
                }
            } else {
                // Dedicated vision endpoint (OpenAI-compatible)
                LlmClient::OpenAI {
                    base_url: normalized_base_url,
                    api_key,
                    chat_model: model.clone(),
                    embed_model: String::new(),
                }
            }
        } else if !api_key.is_empty() {
            // Likely Anthropic (api_key only, no base_url)
            LlmClient::Anthropic {
                base_url: DEFAULT_ANTHROPIC_BASE_URL.to_string(),
                api_key,
                chat_model: model.clone(),
            }
        } else {
            // No dedicated key — reuse main provider with vision model override
            match Self::from_settings(s) {
                Ok(c) => c,
                Err(_) => return None,
            }
        };
        Some((client, Some(model)))
    }

    /// Build a client for embedding only.
    ///
    /// `embedding_base_url` / `embedding_api_key` / `embedding_model` 三者都填写时构成
    /// 独立的向量化作用域；缺任意一项都继承主模型的向量化配置。
    pub fn embed_client_from_settings(s: &HashMap<String, String>) -> Result<Self> {
        let base_url = setting_value(s, "embedding_base_url");
        let api_key = setting_value(s, "embedding_api_key");
        let model = setting_value(s, "embedding_model");

        if !base_url.is_empty() && !api_key.is_empty() && !model.is_empty() {
            let embed_model = model.to_string();
            Ok(LlmClient::OpenAI {
                base_url: base_url.to_string(),
                api_key: api_key.to_string(),
                chat_model: embed_model.clone(),
                embed_model,
            })
        } else {
            Self::from_settings(s)
        }
    }

    /// Build a client for a scoped model configuration.
    ///
    /// Iterates over the provided keys by index and picks the first scope where
    /// `base_url`, `api_key` **and** `model` are all configured, so that
    /// base_url/api_key/model are never mixed across scopes.
    ///
    /// A scope that only sets an endpoint is skipped rather than completed with a
    /// hard-coded model name: an empty role model means "inherit the main model", and
    /// guessing here would silently swap in a model the user never chose.
    ///
    /// Returns the client and a flag indicating whether a dedicated scope was selected.
    pub fn scoped_client_from_settings(
        s: &HashMap<String, String>,
        base_url_keys: &[&str],
        api_key_keys: &[&str],
        model_keys: &[&str],
    ) -> Result<(Self, bool)> {
        let scopes = base_url_keys
            .iter()
            .zip(api_key_keys.iter())
            .zip(model_keys.iter());
        for ((&base_url_key, &api_key_key), &model_key) in scopes {
            let base_url = setting_value(s, base_url_key);
            let api_key = setting_value(s, api_key_key);
            let model = setting_value(s, model_key);
            if !base_url.is_empty() && !api_key.is_empty() && !model.is_empty() {
                return Ok((Self::build_scoped_client(base_url, api_key, model), true));
            }
        }
        Ok((Self::from_settings(s)?, false))
    }

    /// 用已确认完整的 base_url / api_key / model 构造独立作用域客户端。
    fn build_scoped_client(base_url: &str, api_key: &str, model: &str) -> Self {
        let normalized_base_url = normalize_base_url(base_url);
        if is_anthropic_compatible_base_url(&normalized_base_url) {
            LlmClient::Anthropic {
                base_url: normalized_base_url,
                api_key: api_key.to_string(),
                chat_model: model.to_string(),
            }
        } else {
            LlmClient::OpenAI {
                base_url: normalized_base_url,
                api_key: api_key.to_string(),
                chat_model: model.to_string(),
                embed_model: String::new(),
            }
        }
    }

    /// Build a client specifically for literature scout tasks.
    /// Reads `multi_agent_literature_scout_base_url/api_key/model`.
    /// 三者缺任意一项都继承主模型，不用硬编码模型名兜底。
    pub fn scout_client_from_settings(s: &HashMap<String, String>) -> Result<Self> {
        let base_url = setting_value(s, "multi_agent_literature_scout_base_url");
        let api_key = setting_value(s, "multi_agent_literature_scout_api_key");
        let model = setting_value(s, "multi_agent_literature_scout_model");

        if base_url.is_empty() || api_key.is_empty() || model.is_empty() {
            return Self::from_settings(s);
        }

        Ok(Self::build_scoped_client(base_url, api_key, model))
    }

    /// Resolve the literature-search model without losing the Xiaoyan main-model scope.
    /// Priority: dedicated literature scout -> Xiaoyan main role -> global provider.
    pub fn literature_client_with_main_fallback(
        s: &HashMap<String, String>,
    ) -> Result<(Self, Option<String>)> {
        let (client, scoped) = Self::scoped_client_from_settings(
            s,
            &[
                "multi_agent_literature_scout_base_url",
                "copilot_simple_base_url",
            ],
            &[
                "multi_agent_literature_scout_api_key",
                "copilot_simple_api_key",
            ],
            &["multi_agent_literature_scout_model", "copilot_simple_model"],
        )?;
        let model = if scoped {
            None
        } else {
            resolve_model(s, &["copilot_simple_model"])
        };
        Ok((client, model))
    }

    /// Resolve the dedicated literature client and a runtime fallback client.
    ///
    /// A configured scout endpoint can become unavailable or retain an expired key.
    /// In that case callers may retry once with Xiaoyan's main role instead of
    /// dropping immediately to deterministic local behavior.
    pub fn literature_clients_with_runtime_fallback(
        s: &HashMap<String, String>,
    ) -> Result<Vec<(Self, Option<String>)>> {
        let primary = Self::literature_client_with_main_fallback(s)?;
        // 只有 base_url / api_key / model 齐全才算配了专属侦察模型；否则 primary 本身就是
        // 主模型，再追加一个回退会得到两个完全相同的客户端。
        let dedicated_configured = [
            "multi_agent_literature_scout_base_url",
            "multi_agent_literature_scout_api_key",
            "multi_agent_literature_scout_model",
        ]
        .iter()
        .all(|key| s.get(*key).is_some_and(|value| !value.trim().is_empty()));
        if !dedicated_configured {
            return Ok(vec![primary]);
        }

        let mut fallback_settings = s.clone();
        fallback_settings.remove("multi_agent_literature_scout_base_url");
        fallback_settings.remove("multi_agent_literature_scout_api_key");
        fallback_settings.remove("multi_agent_literature_scout_model");
        let mut clients = vec![primary];
        if let Ok(fallback) = Self::literature_client_with_main_fallback(&fallback_settings) {
            clients.push(fallback);
        }
        Ok(clients)
    }
}

// ── 角色参数解析 ────────────────────────────────────────────────

pub fn resolve_model(settings: &HashMap<String, String>, keys: &[&str]) -> Option<String> {
    keys.iter()
        .filter_map(|key| settings.get(*key))
        .map(|value| value.trim())
        .find(|value| !value.is_empty())
        .map(|value| value.to_string())
}

pub fn resolve_temperature(settings: &HashMap<String, String>, key: &str, default: f32) -> f32 {
    settings
        .get(key)
        .and_then(|value| value.trim().parse::<f32>().ok())
        .unwrap_or(default)
}

pub fn resolve_temperature_chain(
    settings: &HashMap<String, String>,
    keys: &[&str],
    default: f32,
) -> f32 {
    keys.iter()
        .filter_map(|key| settings.get(*key))
        .map(|value| value.trim())
        .find_map(|value| value.parse::<f32>().ok())
        .unwrap_or(default)
}

pub fn resolve_max_tokens(settings: &HashMap<String, String>, keys: &[&str], default: u32) -> u32 {
    keys.iter()
        .filter_map(|key| settings.get(*key))
        .map(|value| value.trim())
        .find_map(|value| value.parse::<u32>().ok())
        .unwrap_or(default)
        .clamp(256, 32_768)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn settings(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs
            .iter()
            .map(|(key, value)| ((*key).to_string(), (*value).to_string()))
            .collect()
    }

    fn chat_model(client: &LlmClient) -> &str {
        match client {
            LlmClient::OpenAI { chat_model, .. } | LlmClient::Anthropic { chat_model, .. } => {
                chat_model
            }
        }
    }

    fn main_provider() -> HashMap<String, String> {
        settings(&[
            ("llm_provider", "openai_compatible"),
            ("openai_compatible_base_url", "https://main.example.com/v1"),
            ("openai_compatible_api_key", "main-key"),
            ("openai_compatible_chat_model", "main-model"),
        ])
    }

    #[test]
    fn empty_role_model_inherits_main_even_with_role_endpoint() {
        // 角色配了独立端点但模型留空：必须完全继承主模型，不能落到硬编码模型名。
        let mut s = main_provider();
        s.insert("paper_analysis_base_url".into(), "https://role.example.com/v1".into());
        s.insert("paper_analysis_api_key".into(), "role-key".into());
        s.insert("paper_analysis_model".into(), "".into());

        let (client, scoped) = LlmClient::scoped_client_from_settings(
            &s,
            &["paper_analysis_base_url"],
            &["paper_analysis_api_key"],
            &["paper_analysis_model"],
        )
        .expect("scoped resolution should succeed");

        assert!(!scoped, "空模型不应启用独立作用域");
        assert_eq!(client.base_url(), "https://main.example.com/v1");
        assert_eq!(chat_model(&client), "main-model");
    }

    #[test]
    fn role_scope_requires_base_url_api_key_and_model() {
        let mut s = main_provider();
        s.insert("paper_analysis_base_url".into(), "https://role.example.com/v1".into());
        s.insert("paper_analysis_api_key".into(), "role-key".into());
        s.insert("paper_analysis_model".into(), "role-model".into());

        let (client, scoped) = LlmClient::scoped_client_from_settings(
            &s,
            &["paper_analysis_base_url"],
            &["paper_analysis_api_key"],
            &["paper_analysis_model"],
        )
        .expect("scoped resolution should succeed");

        assert!(scoped);
        assert_eq!(client.base_url(), "https://role.example.com/v1");
        assert_eq!(chat_model(&client), "role-model");
    }

    #[test]
    fn role_model_without_endpoint_keeps_role_model_on_main_provider() {
        let mut s = main_provider();
        s.insert("paper_analysis_model".into(), "role-model".into());

        let (client, scoped) = LlmClient::scoped_client_from_settings(
            &s,
            &["paper_analysis_base_url"],
            &["paper_analysis_api_key"],
            &["paper_analysis_model"],
        )
        .expect("scoped resolution should succeed");

        assert!(!scoped);
        assert_eq!(client.base_url(), "https://main.example.com/v1");
        assert_eq!(
            resolve_model(&s, &["paper_analysis_model"]).as_deref(),
            Some("role-model")
        );
    }

    #[test]
    fn scope_chain_skips_incomplete_scope_instead_of_defaulting() {
        let mut s = main_provider();
        // 首个作用域只有端点，第二个作用域完整：应选中第二个，而不是用默认模型填第一个。
        s.insert("paper_analysis_base_url".into(), "https://stale.example.com/v1".into());
        s.insert("paper_analysis_api_key".into(), "stale-key".into());
        s.insert(
            "multi_agent_paper_analyst_base_url".into(),
            "https://fresh.example.com/v1".into(),
        );
        s.insert("multi_agent_paper_analyst_api_key".into(), "fresh-key".into());
        s.insert("multi_agent_paper_analyst_model".into(), "fresh-model".into());

        let (client, scoped) = LlmClient::scoped_client_from_settings(
            &s,
            &["paper_analysis_base_url", "multi_agent_paper_analyst_base_url"],
            &["paper_analysis_api_key", "multi_agent_paper_analyst_api_key"],
            &["paper_analysis_model", "multi_agent_paper_analyst_model"],
        )
        .expect("scoped resolution should succeed");

        assert!(scoped);
        assert_eq!(client.base_url(), "https://fresh.example.com/v1");
        assert_eq!(chat_model(&client), "fresh-model");
    }

    #[test]
    fn scout_role_without_model_inherits_main() {
        let mut s = main_provider();
        s.insert(
            "multi_agent_literature_scout_base_url".into(),
            "https://scout.example.com/v1".into(),
        );
        s.insert("multi_agent_literature_scout_api_key".into(), "scout-key".into());
        s.insert("multi_agent_literature_scout_model".into(), "".into());

        let client = LlmClient::scout_client_from_settings(&s).expect("scout resolution");
        assert_eq!(client.base_url(), "https://main.example.com/v1");
        assert_eq!(chat_model(&client), "main-model");
    }

    #[test]
    fn scout_role_with_model_uses_dedicated_endpoint() {
        let mut s = main_provider();
        s.insert(
            "multi_agent_literature_scout_base_url".into(),
            "https://scout.example.com/v1".into(),
        );
        s.insert("multi_agent_literature_scout_api_key".into(), "scout-key".into());
        s.insert("multi_agent_literature_scout_model".into(), "scout-model".into());

        let client = LlmClient::scout_client_from_settings(&s).expect("scout resolution");
        assert_eq!(client.base_url(), "https://scout.example.com/v1");
        assert_eq!(chat_model(&client), "scout-model");
    }

    #[test]
    fn embedding_role_without_model_inherits_main() {
        let mut s = settings(&[
            ("llm_provider", "openai_compatible"),
            ("openai_compatible_base_url", "https://main.example.com/v1"),
            ("openai_compatible_api_key", "main-key"),
            ("openai_compatible_embedding_model", "main-embed"),
        ]);
        s.insert("embedding_base_url".into(), "https://embed.example.com/v1".into());
        s.insert("embedding_api_key".into(), "embed-key".into());
        s.insert("embedding_model".into(), "".into());

        let client = LlmClient::embed_client_from_settings(&s).expect("embed resolution");
        assert_eq!(client.base_url(), "https://main.example.com/v1");
    }

    #[test]
    fn embedding_role_with_model_uses_dedicated_endpoint() {
        let mut s = main_provider();
        s.insert("embedding_base_url".into(), "https://embed.example.com/v1".into());
        s.insert("embedding_api_key".into(), "embed-key".into());
        s.insert("embedding_model".into(), "embed-model".into());

        let client = LlmClient::embed_client_from_settings(&s).expect("embed resolution");
        assert_eq!(client.base_url(), "https://embed.example.com/v1");
    }

    #[test]
    fn literature_runtime_fallback_skips_duplicate_main_client() {
        let mut s = main_provider();
        // 只配了端点、没有模型：视为未配置专属侦察模型，不应产生两个相同的回退客户端。
        s.insert(
            "multi_agent_literature_scout_base_url".into(),
            "https://scout.example.com/v1".into(),
        );
        s.insert("multi_agent_literature_scout_api_key".into(), "scout-key".into());
        s.insert("multi_agent_literature_scout_model".into(), "".into());

        let clients = LlmClient::literature_clients_with_runtime_fallback(&s)
            .expect("literature resolution");
        assert_eq!(clients.len(), 1);
    }
}
