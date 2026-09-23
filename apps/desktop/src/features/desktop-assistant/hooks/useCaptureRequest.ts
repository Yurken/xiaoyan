import { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { ContextSourceType } from '../shared'
import type { CaptureContextResponse } from '../capture/shared'

const CAPTURE_COMMANDS: Record<ContextSourceType, string> = {
  selection: 'assistant_get_selection',
  clipboard: 'assistant_get_clipboard',
  paste: 'assistant_create_paste_session',
  screenshot: 'assistant_capture_screen_overlay',
}

export async function discardCaptureSession(sessionId: string) {
  try {
    await invoke<void>('assistant_discard_capture', { sessionId })
  } catch (error) {
    console.warn('[assistant] Failed to discard capture session:', error)
  }
}

/** Resolve selection → clipboard → paste without reading another source after cancellation. */
export function useCaptureRequest() {
  return useCallback(async (sourceType: ContextSourceType, isCurrent: () => boolean) => {
    const sources: ContextSourceType[] = sourceType === 'selection'
      ? ['selection', 'clipboard', 'paste']
      : sourceType === 'clipboard' ? ['clipboard', 'paste'] : [sourceType]
    for (const source of sources) {
      if (!isCurrent()) return null
      let response: CaptureContextResponse
      try {
        response = await invoke<CaptureContextResponse>(CAPTURE_COMMANDS[source], undefined)
      } catch (error) {
        if (!isCurrent()) return null
        if (source === 'selection') continue
        throw error
      }
      if (!isCurrent()) {
        await discardCaptureSession(response.session_id)
        return null
      }
      if ((source === 'selection' || source === 'clipboard')
        && response.status === 'ready' && !response.content?.trim()) {
        await discardCaptureSession(response.session_id)
        continue
      }
      return { response, sourceType: source }
    }
    return null
  }, [])
}
