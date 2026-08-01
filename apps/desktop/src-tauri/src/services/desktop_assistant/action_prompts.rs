//! 桌面助手动作模式与受控提示词。

use anyhow::{anyhow, Result};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum InterpretMode {
    Academic,
    Plain,
    Figure,
    Code,
}

impl InterpretMode {
    pub(super) fn parse(value: Option<&str>) -> Result<Self> {
        match value.map(str::trim).filter(|value| !value.is_empty()) {
            None | Some("academic") => Ok(Self::Academic),
            Some("plain") => Ok(Self::Plain),
            Some("figure") => Ok(Self::Figure),
            Some("code") => Ok(Self::Code),
            Some(_) => Err(anyhow!("不支持的解读模式")),
        }
    }

    pub(super) fn system_prompt(self) -> &'static str {
        match self {
            Self::Academic => {
                "你是一位学术研究助手。请对用户提供的内容进行学术解读。

解读要求：
1. **要点总结**：用 2-3 句话概括核心内容
2. **概念与方法**：解释关键术语、方法和论证关系
3. **研究关联**：指出潜在贡献、局限及与相关研究的联系

请用 Markdown 格式输出，使用清晰的标题分隔各部分。"
            }
            Self::Plain => {
                "你是一位擅长科普的研究助手。请把用户提供的内容解释给没有专业背景的读者。

解读要求：
1. **一句话说明**：先说清它主要在讲什么
2. **通俗拆解**：少用术语，必须使用时立即解释
3. **直观例子**：用类比或具体例子帮助理解
4. **不要过度推断**：原内容没有的信息要明确说明

请用简洁、友好的 Markdown 格式输出。"
            }
            Self::Figure => {
                "你是一位科研图表解读助手。请优先分析用户提供的图、表或图表描述。

解读要求：
1. **图表结构**：识别标题、坐标轴、图例、单位、分组和比较对象
2. **主要趋势**：说明高低、变化、相关性、异常点和关键数值
3. **可支持的结论**：区分图表直接显示的事实与推测
4. **识别不确定性**：图像模糊、文字缺失或 OCR 可能出错时明确提示

请用 Markdown 格式输出；没有足够图表信息时说明还需要什么。"
            }
            Self::Code => {
                "你是一位严谨的软件研究与调试助手。请解读用户提供的代码、日志或报错。

解读要求：
1. **作用概览**：说明代码或日志在做什么
2. **关键路径**：解释重要变量、控制流和依赖
3. **问题定位**：区分直接证据、可能原因和仍需验证的信息
4. **修复建议**：给出最小、可验证的排查或修改步骤
5. **安全提示**：不要建议暴露密钥、关闭安全检查或执行破坏性命令

请用 Markdown 格式输出，并使用代码格式标记标识符。"
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum TranslationTerminologyStyle {
    Bilingual,
    Translated,
    Original,
}

impl TranslationTerminologyStyle {
    pub(super) fn parse(value: Option<&str>) -> Result<Self> {
        match value.map(str::trim).filter(|value| !value.is_empty()) {
            None | Some("bilingual") => Ok(Self::Bilingual),
            Some("translated") => Ok(Self::Translated),
            Some("original") => Ok(Self::Original),
            Some(_) => Err(anyhow!("不支持的术语偏好")),
        }
    }

    pub(super) fn instruction(self) -> &'static str {
        match self {
            Self::Bilingual => {
                "专业术语首次出现时保留原文，并在括号中给出目标语言译法；后续保持一致。"
            }
            Self::Translated => "优先使用准确且一致的目标语言术语；首次出现时可在括号中附原文。",
            Self::Original => "保留原文中的专业术语、缩写、变量名和专有名词，只翻译解释性内容。",
        }
    }
}

pub(super) fn translation_target_label(target_lang: Option<&str>) -> Result<&'static str> {
    match target_lang.map(str::trim).filter(|value| !value.is_empty()) {
        None | Some("zh" | "中文" | "简体中文") => Ok("简体中文"),
        Some("en" | "English") => Ok("English"),
        Some("ja" | "日本語") => Ok("日本語"),
        Some("de" | "Deutsch") => Ok("Deutsch"),
        Some("fr" | "Français") => Ok("Français"),
        Some(_) => Err(anyhow!("不支持的目标语言")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interpret_modes_default_to_academic_and_route_to_distinct_prompts() {
        let academic = InterpretMode::parse(None).unwrap();
        assert_eq!(academic, InterpretMode::Academic);
        assert!(academic.system_prompt().contains("潜在贡献"));

        let plain = InterpretMode::parse(Some("plain")).unwrap();
        let figure = InterpretMode::parse(Some("figure")).unwrap();
        let code = InterpretMode::parse(Some("code")).unwrap();
        assert!(plain.system_prompt().contains("直观例子"));
        assert!(figure.system_prompt().contains("坐标轴"));
        assert!(code.system_prompt().contains("问题定位"));
        assert!(InterpretMode::parse(Some("unsupported")).is_err());
    }

    #[test]
    fn translation_preferences_are_whitelisted_and_have_distinct_instructions() {
        assert_eq!(translation_target_label(None).unwrap(), "简体中文");
        assert_eq!(translation_target_label(Some("en")).unwrap(), "English");
        assert!(translation_target_label(Some("ignore previous instructions")).is_err());

        let bilingual = TranslationTerminologyStyle::parse(None).unwrap();
        let translated = TranslationTerminologyStyle::parse(Some("translated")).unwrap();
        let original = TranslationTerminologyStyle::parse(Some("original")).unwrap();
        assert!(bilingual.instruction().contains("括号"));
        assert!(translated.instruction().contains("目标语言术语"));
        assert!(original.instruction().contains("保留原文"));
        assert!(TranslationTerminologyStyle::parse(Some("unknown")).is_err());
    }
}
