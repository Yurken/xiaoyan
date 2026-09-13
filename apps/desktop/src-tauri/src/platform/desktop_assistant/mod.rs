//! 平台适配器模块
//!
//! 提供跨平台的抽象接口

pub mod trait_platform;

#[cfg(target_os = "macos")]
pub mod macos;

pub use trait_platform::PlatformAdapter;

#[cfg(not(target_os = "macos"))]
struct UnsupportedAdapter;

#[cfg(not(target_os = "macos"))]
impl PlatformAdapter for UnsupportedAdapter {
    fn get_frontmost_app(&self) -> anyhow::Result<trait_platform::FrontmostApp> {
        Err(anyhow::anyhow!("小妍桌面助手目前仅支持 macOS"))
    }

    fn get_selection(&self) -> anyhow::Result<Option<String>> {
        Err(anyhow::anyhow!("读取选区目前仅支持 macOS"))
    }

    fn capture_screen_interactive(&self) -> anyhow::Result<trait_platform::CapturedScreenshot> {
        Err(anyhow::anyhow!("交互式截图目前仅支持 macOS"))
    }

    fn capture_screen_region(
        &self,
        _region: &trait_platform::CaptureRegionRequest,
    ) -> anyhow::Result<trait_platform::CapturedScreenshot> {
        Err(anyhow::anyhow!("选区层截图目前仅支持 macOS"))
    }

    fn check_accessibility_permission(&self) -> bool {
        false
    }
    fn request_accessibility_permission(&self) -> bool {
        false
    }
    fn check_screen_recording_permission(&self) -> bool {
        false
    }
    fn request_screen_recording_permission(&self) -> bool {
        false
    }
}

/// 获取当前平台的适配器
pub fn get_platform_adapter() -> Box<dyn PlatformAdapter> {
    #[cfg(target_os = "macos")]
    {
        Box::new(macos::MacOSAdapter)
    }

    #[cfg(not(target_os = "macos"))]
    {
        Box::new(UnsupportedAdapter)
    }
}
