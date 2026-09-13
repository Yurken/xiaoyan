import { invoke } from '@tauri-apps/api/core'
import { useCallback, useState } from 'react'
import type { ImportConfig } from '../shared'

interface AssistantImportInput {
  sessionId: string
  content: string
  originalContent?: string
  config: ImportConfig
}

export function useAssistantImport() {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const show = useCallback(() => {
    setError(null)
    setOpen(true)
  }, [])

  const close = useCallback(() => {
    if (saving) return
    setError(null)
    setOpen(false)
  }, [saving])

  const confirm = useCallback(async ({
    sessionId,
    content,
    originalContent,
    config,
  }: AssistantImportInput) => {
    const importContent = config.target === 'image' ? originalContent ?? content : content
    const separateOriginal = originalContent && originalContent !== importContent
      ? originalContent
      : null
    setSaving(true)
    setError(null)
    try {
      await invoke('assistant_import', {
        sessionId,
        content: importContent,
        target: config.target,
        title: config.title ?? null,
        tags: config.tags ?? null,
        researchThemeId: config.researchThemeId ?? null,
        preserveOriginal: config.preserveOriginal,
        originalContent: config.preserveOriginal ? separateOriginal : null,
        retentionPolicy: config.retentionPolicy,
      })
      setOpen(false)
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  return { open, saving, error, show, close, confirm }
}
