//! macOS 平台适配器实现
//!
//! 使用 Accessibility API 和 ScreenCaptureKit
//!
//! 注意：ScreenCaptureKit 需要屏幕录制权限。
//! 若用户拒绝权限，会返回错误，前端应提示用户降级到剪贴板/粘贴模式。

use anyhow::{anyhow, Result};
use std::process::Command;

use super::trait_platform::{
    CaptureRegionRequest, CapturedScreenshot, FrontmostApp, PlatformAdapter, ScreenshotRegion,
};

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGPreflightScreenCaptureAccess() -> bool;
    fn CGRequestScreenCaptureAccess() -> bool;
}

/// macOS 平台适配器
pub struct MacOSAdapter;

impl PlatformAdapter for MacOSAdapter {
    fn get_frontmost_app(&self) -> Result<FrontmostApp> {
        // 使用 AppleScript 获取前台应用信息
        let script = r#"
            tell application "System Events"
                set frontmostApp to first application process whose frontmost is true
                set appName to name of frontmostApp
                set bundleId to bundle identifier of frontmostApp
                try
                    set windowTitle to name of front window of frontmostApp
                on error
                    set windowTitle to ""
                end try
                return appName & "|||" & bundleId & "|||" & windowTitle
            end tell
        "#;

        let output = Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map_err(|e| anyhow!("Failed to run osascript: {}", e))?;

        if !output.status.success() {
            // 如果 AppleScript 失败，尝试使用 NSWorkspace
            return self.get_frontmost_app_via_nsworkspace();
        }

        let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let parts: Vec<&str> = result.split("|||").collect();

        if parts.len() >= 3 {
            Ok(FrontmostApp {
                name: Some(parts[0].to_string()),
                bundle_id: Some(parts[1].to_string()),
                window_title: Some(parts[2].to_string()),
            })
        } else {
            Err(anyhow!("Failed to parse frontmost app info"))
        }
    }

    fn get_selection(&self) -> Result<Option<String>> {
        // 只读取 Accessibility 选区。剪贴板降级由采集会话层显式执行，
        // 避免把剪贴板内容错误标记为“选中文本”。
        let script = r#"
            tell application "System Events"
                try
                    set frontmostApp to first application process whose frontmost is true
                    set focusedUI to focused UI element of frontmostApp
                    try
                        set selectedText to value of attribute "AXSelectedText" of focusedUI
                        return selectedText
                    on error
                        return ""
                    end try
                on error
                    return ""
                end try
            end tell
        "#;

        let output = Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map_err(|e| anyhow!("Failed to run osascript: {}", e))?;

        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !text.is_empty() {
                return Ok(Some(text));
            }
        }

        Ok(None)
    }

    fn capture_screen_interactive(&self) -> Result<CapturedScreenshot> {
        let temp_path =
            std::env::temp_dir().join(format!("assistant_capture_{}.png", uuid::Uuid::new_v4()));
        let temp_path_str = temp_path
            .to_str()
            .ok_or_else(|| anyhow!("Invalid temporary capture path"))?;

        let output = Command::new("screencapture")
            .args(["-i", "-s", "-x", temp_path_str])
            .output()
            .map_err(|e| anyhow!("Failed to run screencapture: {}", e))?;

        if !output.status.success() || !temp_path.is_file() {
            let _ = std::fs::remove_file(&temp_path);
            return Err(anyhow!("截图已取消"));
        }

        let image_data =
            std::fs::read(&temp_path).map_err(|e| anyhow!("Failed to read captured image: {}", e));
        let _ = std::fs::remove_file(&temp_path);
        let bytes = image_data?;
        let image = image::load_from_memory_with_format(&bytes, image::ImageFormat::Png)
            .map_err(|error| anyhow!("无法读取截图尺寸: {error}"))?;
        Ok(CapturedScreenshot {
            bytes,
            region: ScreenshotRegion {
                x: None,
                y: None,
                width: image.width(),
                height: image.height(),
            },
        })
    }

    fn capture_screen_region(&self, region: &CaptureRegionRequest) -> Result<CapturedScreenshot> {
        if region.width == 0 || region.height == 0 {
            return Err(anyhow!("选区为空，请重新框选"));
        }
        let temp_path =
            std::env::temp_dir().join(format!("assistant_capture_{}.png", uuid::Uuid::new_v4()));
        let temp_path_str = temp_path
            .to_str()
            .ok_or_else(|| anyhow!("Invalid temporary capture path"))?;

        // screencapture -R 接受 Quartz 全局逻辑坐标（点），覆盖跨显示器、
        // Retina/非 Retina 与外屏位于主屏左侧/上方（负坐标）的场景。
        let rect = format!(
            "-R{},{},{},{}",
            region.x, region.y, region.width, region.height
        );
        let output = Command::new("screencapture")
            .args([&rect, "-x", temp_path_str])
            .output()
            .map_err(|e| anyhow!("Failed to run screencapture: {}", e))?;

        if !output.status.success() || !temp_path.is_file() {
            let _ = std::fs::remove_file(&temp_path);
            return Err(anyhow!("区域截图失败，请重试"));
        }

        let image_data =
            std::fs::read(&temp_path).map_err(|e| anyhow!("Failed to read captured image: {}", e));
        let _ = std::fs::remove_file(&temp_path);
        let bytes = image_data?;
        // 像素宽高始终以实际 PNG 为准，保证 Retina 下可验证。
        let image = image::load_from_memory_with_format(&bytes, image::ImageFormat::Png)
            .map_err(|error| anyhow!("无法读取截图尺寸: {error}"))?;
        Ok(CapturedScreenshot {
            bytes,
            region: ScreenshotRegion {
                x: Some(region.x),
                y: Some(region.y),
                width: image.width(),
                height: image.height(),
            },
        })
    }

    fn check_accessibility_permission(&self) -> bool {
        // 使用 CGPreflightScreenCaptureAccess 检查
        // 或者尝试执行一个需要辅助功能的命令
        let script = r#"
            tell application "System Events"
                try
                    set frontmostApp to first application process whose frontmost is true
                    return "granted"
                on error errMsg
                    if errMsg contains "not allowed" then
                        return "denied"
                    end if
                    return "error"
                end try
            end tell
        "#;

        let output = Command::new("osascript").arg("-e").arg(script).output();

        match output {
            Ok(out) => {
                let result = String::from_utf8_lossy(&out.stdout).trim().to_string();
                result == "granted"
            }
            Err(_) => false,
        }
    }

    fn request_accessibility_permission(&self) -> bool {
        // 打开系统偏好设置的辅助功能页面
        let _ = Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
            .spawn();

        // 等待用户授权后重新检查
        std::thread::sleep(std::time::Duration::from_millis(500));
        self.check_accessibility_permission()
    }

    fn check_screen_recording_permission(&self) -> bool {
        // 只检查状态，不触发系统授权弹窗。
        unsafe { CGPreflightScreenCaptureAccess() }
    }

    fn request_screen_recording_permission(&self) -> bool {
        if unsafe { CGRequestScreenCaptureAccess() } {
            true
        } else {
            let _ = Command::new("open")
                .arg(
                    "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
                )
                .spawn();
            false
        }
    }
}

impl MacOSAdapter {
    /// 使用 NSWorkspace 获取前台应用（备选方案）
    fn get_frontmost_app_via_nsworkspace(&self) -> Result<FrontmostApp> {
        // NSWorkspace 不需要辅助功能权限；窗口标题在未授权时保持为空。
        let script = r#"
            ObjC.import('AppKit');
            const app = $.NSWorkspace.sharedWorkspace.frontmostApplication;
            const name = ObjC.unwrap(app.localizedName) || '';
            const bundleId = ObjC.unwrap(app.bundleIdentifier) || '';
            `${name}|||${bundleId}|||`;
        "#;

        let output = Command::new("osascript")
            .args(["-l", "JavaScript", "-e"])
            .arg(script)
            .output()
            .map_err(|e| anyhow!("Failed to run osascript: {}", e))?;

        if !output.status.success() {
            return Err(anyhow!("Failed to get frontmost app"));
        }

        let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let parts: Vec<&str> = result.split("|||").collect();

        if parts.len() >= 3 {
            Ok(FrontmostApp {
                name: Some(parts[0].to_string()),
                bundle_id: Some(parts[1].to_string()),
                window_title: Some(parts[2].to_string()),
            })
        } else {
            Err(anyhow!("Failed to parse frontmost app info"))
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_get_frontmost_app() {
        // 这个测试在 CI 中可能失败，因为它需要 GUI 环境
        // let result = adapter.get_frontmost_app();
        // assert!(result.is_ok());
    }
}
