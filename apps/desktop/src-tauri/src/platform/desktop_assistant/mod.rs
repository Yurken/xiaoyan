//! 平台适配器模块
//!
//! 提供跨平台的抽象接口

pub mod trait_platform;

#[cfg(target_os = "macos")]
pub mod macos;

pub use trait_platform::PlatformAdapter;

/// 获取当前平台的适配器
pub fn get_platform_adapter() -> Box<dyn PlatformAdapter> {
    #[cfg(target_os = "macos")]
    {
        Box::new(macos::MacOSAdapter)
    }

    #[cfg(target_os = "windows")]
    {
        // TODO: 实现 Windows 适配器
        panic!("Windows adapter not implemented yet")
    }

    #[cfg(target_os = "linux")]
    {
        // TODO: 实现 Linux 适配器
        panic!("Linux adapter not implemented yet")
    }
}
