//! 桌面助手服务模块
//!
//! 提供权限检查、采集会话、动作路由和清理服务

pub mod permission_service;
pub mod capture_service;
pub mod action_service;
pub mod import_service;
pub mod cleanup_service;

pub use permission_service::PermissionService;
pub use capture_service::CaptureService;
pub use cleanup_service::CleanupService;
