import { useCallback, useEffect, useRef } from 'react'

/** One lifetime for preflight input work shared by capture, OCR, chat and panel dismissal. */
export function useAssistantInputScope(resetExtraction: () => void, resetFreeChat: () => void) {
  const inputGeneration = useRef(0)
  const resetPendingInput = useCallback(() => {
    inputGeneration.current += 1
    resetExtraction()
    resetFreeChat()
  }, [resetExtraction, resetFreeChat])

  useEffect(() => () => { inputGeneration.current += 1 }, [])
  return { inputGeneration, resetPendingInput }
}
