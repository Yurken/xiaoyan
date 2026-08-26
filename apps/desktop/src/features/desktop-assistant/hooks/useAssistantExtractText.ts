/**
 * 截图识字（提取文字）hook
 * 职责：调用 vision/OCR 通道提取截图文字，返回可编辑文本
 * 隐私约束与截图动作一致：后端要求会话已确认才会发送模型（PRD §12/§F5）
 */
import { useCallback, useState } from 'react'
import type { AssistantExtractTextResponse } from '../shared'

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  return tauriInvoke<T>(command, args)
}

export interface UseAssistantExtractText {
  extracting: boolean
  error: string | null
  /** 提取成功返回文本；识别为空或失败时返回 null 并设置 error */
  extractText: (sessionId: string, imageContent: string) => Promise<string | null>
  clearError: () => void
}

export function useAssistantExtractText(): UseAssistantExtractText {
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const extractText = useCallback(
    async (sessionId: string, imageContent: string): Promise<string | null> => {
      if (!imageContent.startsWith('data:image/')) {
        setError('提取文字仅支持截图内容')
        return null
      }
      setExtracting(true)
      setError(null)
      try {
        const response = await invoke<AssistantExtractTextResponse>(
          'assistant_extract_text',
          { sessionId, content: imageContent },
        )
        const text = response.content.trim()
        if (!text) {
          // PRD §7.2 F3 验收：OCR 为空时展示下一步。
          setError('未识别到文字，可尝试重新截图或改用手动粘贴')
          return null
        }
        return text
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        return null
      } finally {
        setExtracting(false)
      }
    },
    [],
  )

  const clearError = useCallback(() => setError(null), [])

  return { extracting, error, extractText, clearError }
}
