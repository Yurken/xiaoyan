//! macOS 平台适配器实现
//!
//! 使用 Accessibility API 和 ScreenCaptureKit

use anyhow::Result;

use super::trait_platform::{FrontmostApp, PlatformAdapter};

/// macOS 平台适配器
pub struct MacOSAdapter;

impl PlatformAdapter for MacOSAdapter {
    fn get_frontmost_app(&self) -> Result<FrontmostApp> {
        // TODO: 实现 macOS 前台应用获取
        // 使用 NSWorkspace.frontmostApplication
        Ok(FrontmostApp {
            name: None,
            bundle_id: None,
            window_title: None,
        })
    }

    fn get_selection(&self) -> Result<Option<String>> {
        // TODO: 实现 macOS 选区读取
        // 使用 AXUIElement 读取选中文本
        Ok(None)
    }

    fn capture_screen_region(
        &self,
        _x: i32,
        _y: i32,
        _width: u32,
        _height: u32,
    ) -> Result<Vec<u8>> {
        // TODO: 实现 ScreenCaptureKit 区域截图
        todo!("Implement macOS screen capture")
    }

    fn check_accessibility_permission(&self) -> bool {
        // TODO: 实现 macOS 辅助功能权限检查
        // AXIsProcessTrusted()
        false
    }

    fn request_accessibility_permission(&self) -> bool {
        // TODO: 实现 macOS 辅助功能权限请求
        // AXIsProcessTrustedWithOptions(kAXTrustedCheckOptionPrompt: true)
        false
    }

    fn check_screen_recording_permission(&self) -> bool {
        // TODO: 实现 macOS 屏幕录制权限检查
        // CGPreflightScreenCaptureAccess()
        false
    }

    fn request_screen_recording_permission(&self) -> bool {
        // TODO: 实现 macOS 屏幕录制权限请求
        // CGRequestScreenCaptureAccess()
        false
    }
}
