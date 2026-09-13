//! 桌面助手服务模块
//!
//! 提供权限检查、采集会话、动作路由和清理服务

mod action_prompts;
pub mod action_service;
pub mod capture_overlay_drag;
pub mod capture_service;
pub mod capture_store;
pub mod cleanup_service;
pub mod content_policy;
pub mod file_candidate_service;
#[cfg(test)]
mod file_candidate_service_tests;
pub mod image_asset_service;
#[cfg(test)]
mod image_asset_service_tests;
pub mod import_service;
pub mod inbox_service;
#[cfg(test)]
mod inbox_service_tests;
pub mod knowledge_service;
pub mod metrics_service;
pub mod note_attachment_service;
#[cfg(test)]
mod note_attachment_service_tests;
pub mod permission_service;
pub mod preference_service;
#[cfg(test)]
mod privacy_redaction_tests;
pub mod private_data_service;
#[cfg(test)]
mod private_data_service_tests;
pub mod session_service;
#[cfg(test)]
mod session_service_tests;
pub mod source_service;
#[cfg(test)]
mod source_service_tests;
pub mod terminology_service;

pub use cleanup_service::CleanupService;
pub use permission_service::PermissionService;
pub use preference_service::AssistantPreferenceService;
