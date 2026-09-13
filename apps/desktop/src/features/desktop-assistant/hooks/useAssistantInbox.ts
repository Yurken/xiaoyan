import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AssistantInboxActionResult,
  AssistantInboxOverview,
  AssistantKnowledgeTheme,
} from '../shared'

const EMPTY_INBOX: AssistantInboxOverview = {
  later_items: [],
  paper_candidates: [],
  file_candidates: [],
}

type InboxKind = 'later' | 'paper' | 'file'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function useAssistantInbox() {
  const [overview, setOverview] = useState<AssistantInboxOverview>(EMPTY_INBOX)
  const [themes, setThemes] = useState<AssistantKnowledgeTheme[]>([])
  const [selectedThemeId, setSelectedThemeId] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextOverview, nextThemes] = await Promise.all([
        invoke<AssistantInboxOverview>('assistant_inbox_list'),
        invoke<AssistantKnowledgeTheme[]>('assistant_list_knowledge_themes'),
      ])
      const loadedThemes = Array.isArray(nextThemes) ? nextThemes : []
      setOverview(nextOverview)
      setThemes(loadedThemes)
      setSelectedThemeId((current) => (
        current && loadedThemes.some((theme) => theme.id === current) ? current : ''
      ))
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const run = useCallback(async <T,>(
    itemId: string,
    command: string,
    payload: Record<string, unknown>,
    message: string,
  ) => {
    setActiveItemId(itemId)
    setError(null)
    setNotice(null)
    try {
      const result = await invoke<T>(command, payload)
      setNotice(message)
      await reload()
      return result
    } catch (actionError) {
      setError(errorMessage(actionError))
      return null
    } finally {
      setActiveItemId(null)
    }
  }, [reload])

  const themePayload = useMemo(
    () => ({ researchThemeId: selectedThemeId || null }),
    [selectedThemeId],
  )

  const convertLater = useCallback((itemId: string) => run<AssistantInboxActionResult>(
    itemId,
    'assistant_inbox_convert_later',
    { itemId, ...themePayload },
    '已转为知识笔记',
  ), [run, themePayload])

  const importPaper = useCallback((candidateId: string) => run<AssistantInboxActionResult>(
    candidateId,
    'assistant_inbox_import_paper',
    { candidateId, ...themePayload },
    '论文已进入论文库，后台解析已开始',
  ), [run, themePayload])

  const importFile = useCallback((candidateId: string, target: 'note' | 'image') => (
    run<AssistantInboxActionResult>(
      candidateId,
      'assistant_inbox_import_file',
      { candidateId, ...themePayload },
      target === 'note' ? '文件已转为知识笔记' : '图片已保存到本地资产',
    )
  ), [run, themePayload])

  const discard = useCallback((kind: InboxKind, itemId: string) => {
    const command = {
      later: 'assistant_inbox_discard_later',
      paper: 'assistant_inbox_discard_paper',
      file: 'assistant_inbox_discard_file',
    }[kind]
    const idKey = kind === 'later' ? 'itemId' : 'candidateId'
    return run<void>(itemId, command, { [idKey]: itemId }, '已从收集箱移除')
  }, [run])

  return {
    overview,
    themes,
    selectedThemeId,
    loading,
    activeItemId,
    error,
    notice,
    setSelectedThemeId,
    reload,
    convertLater,
    importPaper,
    importFile,
    discard,
  }
}

export type UseAssistantInbox = ReturnType<typeof useAssistantInbox>
