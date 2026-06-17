# 应用图标占位

DevEco Studio 工程需要应用图标。请在以下两处各放一份 `app_icon.png`（建议 1024×1024 PNG）：

- `AppScope/resources/base/media/app_icon.png` —— 供 `AppScope/app.json5` 的 `icon` 引用
- `entry/src/main/resources/base/media/app_icon.png` —— 供 `module.json5` 的 ability `icon` / `startWindowIcon` 引用

可直接复用桌面端图标（`apps/desktop/src-tauri/icons/`）转换而来。
未放置图标时 DevEco 构建会报缺资源；这是当前脚手架唯一需要补充的二进制资产。
