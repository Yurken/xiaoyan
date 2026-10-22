//! 小妍把主模型 API 同步给外部代码助手（DSH / Pi）时的模型输入能力判定。
//!
//! 两个 harness 都把模型条目的 `input` 当作对端点的事实声明：列表里没有 `image` 的模型，
//! 带图片的请求在发出前就被拒（DSH 报 `pi-ai model "x" does not support image input`，
//! Pi 的 model-config 同样把缺省收口成 `["text"]`）。小妍的网关模型是一条条写进配置的，
//! 所以必须在写入时就表态：能读图片的模型声明 `[text, image]`，确定不消费图片输入的非对话
//! 模型声明 `[text]`，判不出来的不逐条表态，交给网关级 `defaultInput` 兜底。
//!
//! 兜底方向选“允许图片”而不是“只允许文本”：网关模型的命名千奇百怪，没有任何接口能回答它
//! 到底收不收图片，而两种错的代价不同——少报会让用户在小妍里完全无法贴图（历史事故），
//! 多报只会在图片确实不被接受时由 provider 报错，用户换个模型或撤掉图片即可恢复。

use serde_json::Value as JsonValue;

/// 模型的图片输入能力档位。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum ImageCapability {
    /// 能读图片的多模态对话模型。
    Vision,
    /// 确定不接收图片输入：embedding、rerank、ASR/TTS、图片与视频生成等。
    TextOnly,
    /// 没有任何可靠线索，由网关级默认值决定。
    Unknown,
}

/// 判定为多模态对话模型的名称标记；对小写模型 id 做子串匹配，且先于只读文本的标记。
const VISION_MARKERS: [&str; 15] = [
    "vl",
    "4v",
    "5v",
    "qvq",
    "vision",
    "visual",
    "omni",
    "multimodal",
    "ocr",
    "gemini",
    "claude",
    "gpt-4o",
    "gpt-4.1",
    "gpt-4v",
    "gpt-5",
];

/// 判定为不接收图片输入的名称标记：向量与重排、语音与音频、图片视频生成、内容审核。
const TEXT_ONLY_MARKERS: [&str; 19] = [
    "embedding",
    "embed",
    "rerank",
    "bge",
    "m3e",
    "asr",
    "tts",
    "stt",
    "whisper",
    "audio",
    "speech",
    "voice",
    "moderation",
    "image",
    "video",
    "t2v",
    "i2v",
    "dall-e",
    "flux",
];

/// 依据模型 id 判定图片输入能力，`Unknown` 表示名称里没有线索。
pub(crate) fn image_capability_from_model_id(model_id: &str) -> ImageCapability {
    let normalized = model_id.to_lowercase();
    if VISION_MARKERS
        .iter()
        .any(|marker| normalized.contains(marker))
    {
        return ImageCapability::Vision;
    }
    if TEXT_ONLY_MARKERS
        .iter()
        .any(|marker| normalized.contains(marker))
    {
        return ImageCapability::TextOnly;
    }
    ImageCapability::Unknown
}

/// 读取模型列表接口里的模态声明。标准 `GET /models` 不回答能力，
/// 但增强网关会带 `architecture.input_modalities`（OpenRouter）或 `vision` 布尔标记。
pub(crate) fn image_capability_from_listing(entry: &JsonValue) -> ImageCapability {
    for path in [
        vec!["capabilities", "vision"],
        vec!["vision"],
        vec!["supports_vision"],
    ] {
        if let Some(flag) = read_bool(entry, &path) {
            return if flag {
                ImageCapability::Vision
            } else {
                ImageCapability::TextOnly
            };
        }
    }
    for path in [
        vec!["architecture", "input_modalities"],
        vec!["input_modalities"],
        vec!["supported_modalities"],
        vec!["modalities"],
    ] {
        if let Some(modalities) = read_string_array(entry, &path) {
            if modalities.is_empty() {
                continue;
            }
            return if modalities.iter().any(|item| item == "image") {
                ImageCapability::Vision
            } else {
                ImageCapability::TextOnly
            };
        }
    }
    ImageCapability::Unknown
}

/// 列表元数据优先于模型名：网关自己声明的能力比命名习惯可信。
pub(crate) fn resolve_image_capability(
    listing: ImageCapability,
    model_id: &str,
) -> ImageCapability {
    if listing != ImageCapability::Unknown {
        return listing;
    }
    image_capability_from_model_id(model_id)
}

/// 写入 harness 配置的 `input` 数组取值：只有确定不消费图片输入的模型才收口成 `[text]`，
/// 未知与多模态都声明 `[text, image]`，与 DSH 网关级 `defaultInput` 的兜底方向一致。
pub(crate) fn input_modalities(capability: ImageCapability) -> &'static [&'static str] {
    match capability {
        ImageCapability::TextOnly => &["text"],
        ImageCapability::Vision | ImageCapability::Unknown => &["text", "image"],
    }
}

fn read_bool(entry: &JsonValue, path: &[&str]) -> Option<bool> {
    let mut node = entry;
    for key in path {
        node = node.get(*key)?;
    }
    node.as_bool()
}

fn read_string_array(entry: &JsonValue, path: &[&str]) -> Option<Vec<String>> {
    let mut node = entry;
    for key in path {
        node = node.get(*key)?;
    }
    node.as_array().map(|items| {
        items
            .iter()
            .filter_map(JsonValue::as_str)
            .map(str::to_string)
            .collect()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn recognizes_multimodal_chat_families() {
        for model_id in [
            "qwen3-vl-plus",
            "gpt-4o-mini",
            "claude-sonnet-4-5",
            "gemini-2.5-flash",
            "ZHIPU/GLM-4.5v",
            "deepseek-ocr",
            "qvq-max",
            "Qwen2.5-Omni-7B",
        ] {
            assert_eq!(
                image_capability_from_model_id(model_id),
                ImageCapability::Vision,
                "{model_id} 应判定为可读图片"
            );
        }
    }

    #[test]
    fn confines_non_chat_families_to_text_only() {
        for model_id in [
            "qwen3.7-text-embedding-flash",
            "text-embedding-v3",
            "qwen3.7-text-rerank",
            "qwen-audio-3.0-asr-flash",
            "cosyvoice-v2",
            "qwen-image-3.0-pro",
            "dall-e-3",
            "wan2.2-t2v-plus",
            "bge-m3",
        ] {
            assert_eq!(
                image_capability_from_model_id(model_id),
                ImageCapability::TextOnly,
                "{model_id} 不应声明图片输入"
            );
        }
    }

    #[test]
    fn leaves_unfamiliar_gateway_models_unknown() {
        for model_id in ["deepseek-v4-flash", "kimi-k3", "stepfun/step-3.7-flash"] {
            assert_eq!(
                image_capability_from_model_id(model_id),
                ImageCapability::Unknown,
                "{model_id} 没有可靠的名称线索"
            );
        }
    }

    #[test]
    fn reads_modalities_declared_by_enriched_gateways() {
        assert_eq!(
            image_capability_from_listing(&json!({
                "id": "router-model",
                "architecture": { "input_modalities": ["text", "image", "audio"] }
            })),
            ImageCapability::Vision
        );
        assert_eq!(
            image_capability_from_listing(&json!({ "input_modalities": ["text"] })),
            ImageCapability::TextOnly
        );
        assert_eq!(
            image_capability_from_listing(&json!({ "vision": true })),
            ImageCapability::Vision
        );
        assert_eq!(
            image_capability_from_listing(&json!({ "id": "plain" })),
            ImageCapability::Unknown
        );
        // 空数组不构成回答，继续按未知处理。
        assert_eq!(
            image_capability_from_listing(&json!({ "modalities": [] })),
            ImageCapability::Unknown
        );
    }

    #[test]
    fn listing_declaration_wins_over_the_model_name() {
        assert_eq!(
            resolve_image_capability(ImageCapability::Vision, "gateway-deploy-042"),
            ImageCapability::Vision
        );
        assert_eq!(
            resolve_image_capability(ImageCapability::TextOnly, "qwen3-vl-plus"),
            ImageCapability::TextOnly
        );
        assert_eq!(
            resolve_image_capability(ImageCapability::Unknown, "qwen3-vl-plus"),
            ImageCapability::Vision
        );
    }

    #[test]
    fn only_confidently_text_only_models_drop_image() {
        assert_eq!(input_modalities(ImageCapability::Vision), ["text", "image"]);
        assert_eq!(
            input_modalities(ImageCapability::Unknown),
            ["text", "image"]
        );
        assert_eq!(input_modalities(ImageCapability::TextOnly), ["text"]);
    }
}
