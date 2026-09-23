/**
 * 截图识字（提取文字）hook
 * 职责：调用 vision/OCR 通道提取截图文字，返回可编辑文本
 * 隐私约束与截图动作一致：后端要求会话已确认才会发送模型（PRD §12/§F5）
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AssistantExtractTextResponse } from '../shared'

export interface UseAssistantExtractText {
  extracting: boolean
  error: string | null
  /** 提取成功返回文本；识别为空或失败时返回 null 并设置 error */
  extractText: (sessionId: string, imageContent: string) => Promise<string | null>
  clearError: () => void
  /** 清空状态并使未完成的识字结果失效。 */
  reset: () => void
}

export function useAssistantExtractText(): UseAssistantExtractText {
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activeRequestRef = useRef<object | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      activeRequestRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    activeRequestRef.current = null
    setExtracting(false)
    setError(null)
  }, [])

  const extractText = useCallback(
    async (sessionId: string, imageContent: string): Promise<string | null> => {
      if (!mountedRef.current || activeRequestRef.current) return null
      if (!imageContent.startsWith('data:image/')) {
        setError('提取文字仅支持截图内容')
        return null
      }
      const request = {}
      activeRequestRef.current = request
      const isCurrent = () => mountedRef.current && activeRequestRef.current === request
      setExtracting(true)
      setError(null)
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        if (!isCurrent()) return null
        const response = await invoke<AssistantExtractTextResponse>(
          'assistant_extract_text',
          { sessionId, content: imageContent },
        )
        if (!isCurrent()) return null
        const text = response.content.trim()
        if (!text) {
          // PRD §7.2 F3 验收：OCR 为空时展示下一步。
          setError('未识别到文字，可尝试重新截图或改用手动粘贴')
          return null
        }
        return text
      } catch (err) {
        if (isCurrent()) setError(err instanceof Error ? err.message : String(err))
        return null
      } finally {
        if (isCurrent()) {
          activeRequestRef.current = null
          setExtracting(false)
        }
      }
    },
    [],
  )

  const clearError = useCallback(() => setError(null), [])

  return { extracting, error, extractText, clearError, reset }
}
