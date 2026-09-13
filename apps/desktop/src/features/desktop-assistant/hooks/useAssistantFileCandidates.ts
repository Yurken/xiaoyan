import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { safeOnDragDrop } from '../../../lib/tauriEvent'
import type {
  AssistantFileCandidate,
  FileCandidateInspection,
} from '../shared'

async function discardCandidates(candidateIds: string[]) {
  if (candidateIds.length === 0) return
  await invoke('assistant_discard_file_candidates', { candidateIds })
}

export function useAssistantFileCandidates() {
  const [inspection, setInspection] = useState<FileCandidateInspection | null>(null)
  const [confirmedCandidates, setConfirmedCandidates] =
    useState<AssistantFileCandidate[] | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const previewIdsRef = useRef<string[]>([])
  const generationRef = useRef(0)

  const inspect = useCallback(async (paths: string[]) => {
    if (paths.length === 0) return
    const generation = ++generationRef.current
    setLoading(true)
    setError(null)
    setConfirmedCandidates(null)
    try {
      const previousIds = previewIdsRef.current
      previewIdsRef.current = []
      if (previousIds.length > 0) {
        await discardCandidates(previousIds).catch(() => {
          // 过期候选会由后端定时清理，不阻断新一轮拖入。
        })
      }
      const next = await invoke<FileCandidateInspection>(
        'assistant_create_file_candidates',
        { paths },
      )
      if (generation !== generationRef.current) {
        await discardCandidates(next.candidates.map((candidate) => candidate.id)).catch(() => {})
        return
      }
      previewIdsRef.current = next.candidates.map((candidate) => candidate.id)
      setInspection(next)
    } catch (inspectError) {
      if (generation !== generationRef.current) return
      setInspection(null)
      setError(inspectError instanceof Error ? inspectError.message : String(inspectError))
    } finally {
      if (generation === generationRef.current) setLoading(false)
    }
  }, [])

  const confirm = useCallback(async () => {
    const candidateIds = previewIdsRef.current
    if (candidateIds.length === 0) return false
    const generation = generationRef.current
    setConfirming(true)
    setError(null)
    try {
      const confirmed = await invoke<AssistantFileCandidate[]>(
        'assistant_confirm_file_candidates',
        { candidateIds },
      )
      if (generation !== generationRef.current) return false
      previewIdsRef.current = []
      setInspection(null)
      setConfirmedCandidates(confirmed)
      return true
    } catch (confirmError) {
      if (generation !== generationRef.current) return false
      setError(confirmError instanceof Error ? confirmError.message : String(confirmError))
      return false
    } finally {
      if (generation === generationRef.current) setConfirming(false)
    }
  }, [])

  const cancel = useCallback(async () => {
    generationRef.current += 1
    const candidateIds = previewIdsRef.current
    previewIdsRef.current = []
    setInspection(null)
    setError(null)
    try {
      await discardCandidates(candidateIds)
    } catch (discardError) {
      setError(discardError instanceof Error ? discardError.message : String(discardError))
    }
  }, [])

  const clearTemporaryState = useCallback(() => {
    generationRef.current += 1
    previewIdsRef.current = []
    setInspection(null)
    setConfirmedCandidates(null)
    setDragActive(false)
    setLoading(false)
    setConfirming(false)
    setError(null)
  }, [])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    let disposed = false
    void safeOnDragDrop((event) => {
      const payload = event.payload
      if (payload.type === 'enter' || payload.type === 'over') {
        setDragActive(true)
      } else if (payload.type === 'leave') {
        setDragActive(false)
      } else if (payload.type === 'drop') {
        setDragActive(false)
        void inspect(payload.paths)
      }
    }).then((stop) => {
      if (disposed) stop()
      else unlisten = stop
    })

    return () => {
      disposed = true
      unlisten?.()
      const candidateIds = previewIdsRef.current
      previewIdsRef.current = []
      void discardCandidates(candidateIds).catch(() => {
        // 窗口卸载时尽力清理，失败候选仍有 24 小时过期策略。
      })
    }
  }, [inspect])

  return {
    inspection,
    confirmedCandidates,
    dragActive,
    loading,
    confirming,
    error,
    inspect,
    confirm,
    cancel,
    clearConfirmation: () => setConfirmedCandidates(null),
    clearTemporaryState,
  }
}
