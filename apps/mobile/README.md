# 小妍 Android 陪伴端

轻量陪伴端：可读论文、知识笔记、聊天历史。连接兼容 HTTP API 后可登录、聊天、生成综述/学习路径并触发论文分析。后端不可达时，可从 WebDAV 同步副本只读浏览。

本 monorepo **当前不包含端口 8000 的 HTTP 后端实现**。在线能力必须连接另行部署、且兼容 `packages/api-sdk` 契约的服务。不要假设开箱即有后端。

## 环境

- Node >= 20.19.4（与 React Native 0.81.5 `package.json` engines 一致）
- pnpm 9
- JDK 17
- Android SDK

当前技术基线：Expo SDK 54 / React Native 0.81.5，Android `targetSdk` / `compileSdk` API 36，支持 16 KB 页面。

## 安装与检查

```bash
pnpm install
pnpm --dir apps/mobile run type-check
pnpm --dir apps/mobile run lint
pnpm --dir apps/mobile run test
pnpm --dir apps/mobile exec expo install --check
pnpm --dir apps/mobile run android
```

## API 地址

- Android 模拟器 debug 默认：`http://10.0.2.2:8000`
- 真机：填电脑局域网地址，或 HTTPS 公网地址
- 正式构建应使用 HTTPS

在设置页可测试并保存地址。更换地址会退出当前后端账号，需要在新后端重新登录；保存失败时继续使用原地址。应用启动时先恢复地址与登录状态，再加载业务页面。

旧版本未绑定后端地址的登录凭据不自动迁移，首次升级需要重新登录。读取设置失败时会显示重试入口。

## WebDAV

在设置中配置 WebDAV 地址与凭据，通过同步入口拉取副本。后端不可达时，用本地同步副本只读浏览论文、笔记和聊天历史。

## 通知

目前只完成本地权限与测试通知。远程后台任务完成提醒仍需后端推送服务，以及真实 EAS `projectId`。

## EAS 构建

需要真实环境变量，**不得放假值**：

- `EXPO_TOKEN`
- `EXPO_PROJECT_ID`

- preview：输出 APK
- production：输出 AAB

## GitHub Actions APK

`Android APK` 流水线会在涉及移动端的 PR、`master` 更新时自动运行，也可在 GitHub Actions 中手动触发。流水线会先执行移动端 lint、类型检查和测试，再通过仓库内的 Gradle Wrapper 构建 `assembleRelease`，并上传：

- `xiaoyan-android-preview.apk`
- `xiaoyan-android-preview.apk.sha256`

产物保留 14 天。当前 Android release 构建沿用仓库内的 debug keystore，适合内部安装验证；应用商店发布继续使用 EAS production 配置和正式签名。

## 常见排障

- **连接失败**：确认另行部署的兼容服务已启动，地址对模拟器/真机可达；模拟器 debug 用 `http://10.0.2.2:8000`，真机用局域网或 HTTPS 公网地址；正式构建用 HTTPS。在设置页先测连通再保存。
- **登录失败**：确认服务实现了 `packages/api-sdk` 契约，账号与地址正确，且请求能到达该服务。本仓库不自带 8000 端口后端。
- **没有同步副本**：先在设置中配好 WebDAV 并执行同步；未同步成功时无法只读浏览。
