import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import type { AssistantKnowledgeTheme } from '../shared'

export function useAssistantKnowledge() {
  const [themes, setThemes] = useState<AssistantKnowledgeTheme[]>([])
  const [selectedThemeId, setSelectedThemeId] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadThemes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await invoke<AssistantKnowledgeTheme[]>(
        'assistant_list_knowledge_themes',
      )
      const loaded = Array.isArray(response) ? response : []
      setThemes(loaded)
      setSelectedThemeId((current) => {
        if (loaded.some((theme) => theme.id === current)) return current
        return loaded[0]?.id ?? ''
      })
      if (loaded.length === 0) setEnabled(false)
    } catch (loadError) {
      setThemes([])
      setSelectedThemeId('')
      setEnabled(false)
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadThemes()
  }, [loadThemes])

  const setKnowledgeEnabled = useCallback((nextEnabled: boolean) => {
    if (nextEnabled && themes.length === 0) {
      setEnabled(false)
      setError('请先创建研究主题并添加论文、知识笔记或 Wiki')
      return
    }
    setError(null)
    setEnabled(nextEnabled)
  }, [themes.length])

  const selectTheme = useCallback((themeId: string) => {
    if (!themes.some((theme) => theme.id === themeId)) return
    setSelectedThemeId(themeId)
    setError(null)
  }, [themes])

  return {
    themes,
    selectedThemeId,
    enabled,
    loading,
    error,
    setKnowledgeEnabled,
    selectTheme,
    reload: loadThemes,
  }
}
