//! 平台适配器 trait 定义

use anyhow::Result;

/// 平台适配器 trait
///
/// 定义跨平台的系统能力抽象
pub trait PlatformAdapter: Send + Sync {
    /// 获取前台应用信息
    fn get_frontmost_app(&self) -> Result<FrontmostApp>;

    /// 读取选中文本
    fn get_selection(&self) -> Result<Option<String>>;

    /// 由系统提供交互式区域选择并返回 PNG 数据。
    fn capture_screen_interactive(&self) -> Result<Vec<u8>>;

    /// 检查辅助功能权限
    fn check_accessibility_permission(&self) -> bool;

    /// 请求辅助功能权限
    fn request_accessibility_permission(&self) -> bool;

    /// 检查屏幕录制权限
    fn check_screen_recording_permission(&self) -> bool;

    /// 请求屏幕录制权限
    fn request_screen_recording_permission(&self) -> bool;
}

/// 前台应用信息
#[derive(Debug, Clone)]
pub struct FrontmostApp {
    /// 应用名称
    pub name: Option<String>,
    /// Bundle ID
    pub bundle_id: Option<String>,
    /// 窗口标题
    pub window_title: Option<String>,
}
