/**
 * 直达动作桥接（P1-1，PRD §16.2）
 *
 * useCaptureSession 在面板窗口内接收 Rust 的 assistant://direct-action 事件并走现有
 * 采集管线；采集确认后需要跳过动作选择直接启动动作，但动作流状态由 useAssistantSession
 * 持有。两个 hook 同处面板窗口，这里用模块级注册表把动作启动器暴露给采集管线，
 * 避免改动 AssistantPanelWindow 的组合关系。模块状态按 webview 隔离，不会跨窗口串扰。
 */
import type { StartAssistantActionInput } from './hooks/useAssistantActionStream'

export type AssistantDirectActionStarter = (
  input: StartAssistantActionInput,
) => Promise<boolean>

let starter: AssistantDirectActionStarter | null = null

/** 由 useAssistantSession 挂载时注册动作启动器，返回注销函数。 */
export function registerAssistantDirectActionStarter(
  next: AssistantDirectActionStarter,
): () => void {
  starter = next
  return () => {
    if (starter === next) starter = null
  }
}

/** 启动已确认的直达动作；动作流尚未挂载时返回 null，调用方降级为手动选择动作。 */
export function startAssistantDirectAction(
  input: StartAssistantActionInput,
): Promise<boolean> | null {
  return starter ? starter(input) : null
}
