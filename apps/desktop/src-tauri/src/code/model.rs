//! Native code model selection must agree with the workspace selector and saved reproduction role.
use std::collections::HashMap;

pub(super) fn resolve_code_model(
    settings: &HashMap<String, String>,
    selected_model: Option<&str>,
) -> Option<String> {
    selected_model
        .map(str::trim)
        .filter(|model| !model.is_empty())
        .map(str::to_owned)
        .or_else(|| {
            crate::llm::resolve_model(
                settings,
                &[
                    "multi_agent_reproduction_model",
                    "paper_reproduction_model",
                    "code_assistant_model",
                    "copilot_simple_model",
                    "paper_analysis_model",
                ],
            )
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn workspace_selection_is_used_for_generation_despite_saved_role_models() {
        let settings = HashMap::from([
            (
                "multi_agent_reproduction_model".into(),
                "saved-code-model".into(),
            ),
            ("copilot_simple_model".into(), "chat-model".into()),
        ]);
        assert_eq!(
            resolve_code_model(&settings, Some(" selected-code-model ")),
            Some("selected-code-model".into())
        );
    }

    #[test]
    fn requests_without_selection_use_the_persisted_workspace_model() {
        let mut settings = HashMap::from([
            (
                "multi_agent_reproduction_model".into(),
                "saved-code-model".into(),
            ),
            (
                "paper_reproduction_model".into(),
                "legacy-code-model".into(),
            ),
            ("copilot_simple_model".into(), "chat-model".into()),
        ]);
        assert_eq!(
            resolve_code_model(&settings, None),
            Some("saved-code-model".into())
        );
        settings.insert("multi_agent_reproduction_model".into(), " ".into());
        assert_eq!(
            resolve_code_model(&settings, Some(" ")),
            Some("legacy-code-model".into())
        );
    }
}
