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

    /// 截取屏幕区域
    fn capture_screen_region(
        &self,
        x: i32,
        y: i32,
        width: u32,
        height: u32,
    ) -> Result<Vec<u8>>;

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
