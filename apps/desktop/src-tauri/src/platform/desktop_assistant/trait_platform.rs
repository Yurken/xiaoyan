//! 平台适配器 trait 定义

use anyhow::Result;
use serde::{Deserialize, Serialize};

/// 平台适配器 trait
///
/// 定义跨平台的系统能力抽象
pub trait PlatformAdapter: Send + Sync {
    /// 获取前台应用信息
    fn get_frontmost_app(&self) -> Result<FrontmostApp>;

    /// 读取选中文本
    fn get_selection(&self) -> Result<Option<String>>;

    /// 由系统提供交互式区域选择并返回 PNG 数据及可验证的像素范围。
    fn capture_screen_interactive(&self) -> Result<CapturedScreenshot>;

    /// 按自有跨显示器选区层回传的全局逻辑选区截取屏幕，
    /// 返回 PNG 数据、全局逻辑坐标与可验证的像素范围。
    fn capture_screen_region(&self, region: &CaptureRegionRequest) -> Result<CapturedScreenshot>;

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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScreenshotRegion {
    /// 选区在全局逻辑坐标系中的原点（点，主屏左上角为原点，外屏在左侧/上方时为负）。
    /// 系统截图工具未公开全局选区坐标时保持为空。
    pub x: Option<i32>,
    pub y: Option<i32>,
    /// 截图 PNG 的可验证像素尺寸（已按显示器缩放比例换算）。
    pub width: u32,
    pub height: u32,
}

/// 跨显示器选区层回传的全局逻辑选区（点坐标，可为负）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct CaptureRegionRequest {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone)]
pub struct CapturedScreenshot {
    pub bytes: Vec<u8>,
    pub region: ScreenshotRegion,
}
