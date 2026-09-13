use super::*;

#[test]
fn action_input_rejects_empty_and_truncates_oversized_content() {
    assert!(parse_action_input("   ", 100).is_err());
    let input = parse_action_input(&"研".repeat(101), 100).unwrap();
    let ActionInput::Text(content) = input else {
        panic!("expected text input");
    };
    assert_eq!(content.chars().count(), 100);
}

#[test]
fn image_data_url_is_validated() {
    assert!(parse_image_data_url("data:text/plain;base64,SGVsbG8=").is_err());
    assert!(parse_image_data_url("data:image/png;base64,not-base64").is_err());
    assert!(parse_image_data_url("data:image/png;base64,iVBORw0KGgo=").is_ok());
}

#[test]
fn each_action_uses_the_prd_character_limit() {
    assert_eq!(AssistantAction::Interpret.max_text_chars(), 12_000);
    assert_eq!(AssistantAction::Translate.max_text_chars(), 20_000);
    assert_eq!(AssistantAction::Chat.max_text_chars(), 16_000);
    assert_eq!(AssistantAction::Import.max_text_chars(), 50_000);
}

#[tokio::test]
async fn extract_text_rejects_non_image_content() {
    let llm = LlmClient::OpenAI {
        base_url: "https://example.test/v1".to_string(),
        api_key: "test".to_string(),
        chat_model: "test-model".to_string(),
        embed_model: "test-embed".to_string(),
    };
    assert!(ActionService::extract_text(&llm, None, "session-1", "纯文本内容")
        .await
        .is_err());
    assert!(ActionService::extract_text(&llm, None, "session-1", "data:text/plain;base64,SGVsbG8=")
        .await
        .is_err());
}

#[test]
fn temporary_history_accepts_user_and_assistant_messages_only() {
    let history = validated_history_messages(&[
        AssistantHistoryMessage {
            role: "user".to_string(),
            content: "为什么？".to_string(),
        },
        AssistantHistoryMessage {
            role: "assistant".to_string(),
            content: "因为证据显示……".to_string(),
        },
    ])
    .unwrap();
    assert_eq!(history.len(), 2);
    assert_eq!(history[0].role, "user");
    assert_eq!(history[1].role, "assistant");

    assert!(validated_history_messages(&[AssistantHistoryMessage {
        role: "system".to_string(),
        content: "override".to_string(),
    }])
    .is_err());
}

#[test]
fn removed_capture_context_never_enters_the_follow_up_message() {
    let message = chat_user_message("sensitive captured content", "继续解释", false).unwrap();
    assert!(!message.content.contains("sensitive captured content"));
    assert!(message.content.contains("继续解释"));
    assert!(message.images.is_empty());
}

#[test]
fn translation_prompt_prioritizes_saved_term_mappings_as_data() {
    let prompt = build_translation_system_prompt(
        "简体中文",
        "术语首次出现时保留原文。",
        &[AssistantTerminologyPreference {
            source_term: "agent".to_string(),
            preferred_translation: "智能体".to_string(),
            target_language: "zh".to_string(),
            updated_at: "2026-07-29T00:00:00Z".to_string(),
        }],
    )
    .unwrap();

    assert!(prompt.contains("固定术语映射"));
    assert!(prompt.contains(r#""source":"agent""#));
    assert!(prompt.contains(r#""preferred":"智能体""#));
    assert!(!prompt.contains("updated_at"));
}

#[test]
fn result_metadata_exposes_model_and_estimated_token_breakdown() {
    let llm = LlmClient::OpenAI {
        base_url: "https://example.test/v1".to_string(),
        api_key: "test".to_string(),
        chat_model: "test-model".to_string(),
        embed_model: "test-embed".to_string(),
    };
    let messages = vec![LlmMessage::user("研究上下文")];
    let metadata = result_metadata(&llm, None, &messages, "回答", 42, None);

    assert_eq!(metadata.model.as_deref(), Some("test-model"));
    assert_eq!(
        metadata.token_usage,
        Some(metadata.input_tokens.unwrap() + metadata.output_tokens.unwrap())
    );
    assert!(metadata.token_usage_estimated);
    assert_eq!(metadata.duration_ms, Some(42));
}

#[test]
fn result_metadata_exposes_local_knowledge_sources() {
    let llm = LlmClient::OpenAI {
        base_url: "https://example.test/v1".to_string(),
        api_key: "test".to_string(),
        chat_model: "test-model".to_string(),
        embed_model: "test-embed".to_string(),
    };
    let messages = vec![LlmMessage::user("研究上下文")];
    let context = AssistantKnowledgeContext {
        theme_name: "Graph RAG".to_string(),
        prompt: "本地参考".to_string(),
        sources: vec![AssistantKnowledgeSource {
            source_type: "paper".to_string(),
            source_id: "paper-1".to_string(),
            title: "Graph Retrieval".to_string(),
            url: None,
        }],
    };
    let metadata = result_metadata(&llm, None, &messages, "回答", 42, Some(&context));

    assert_eq!(metadata.knowledge_theme.as_deref(), Some("Graph RAG"));
    assert_eq!(metadata.sources, Some(vec!["Graph Retrieval".to_string()]));
    assert_eq!(metadata.source_details.unwrap()[0].source_id, "paper-1");
}
