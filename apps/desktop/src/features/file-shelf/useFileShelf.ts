import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { safeListen, safeOnDragDrop } from '../../lib/tauriEvent'
import type { FileShelfItem, FileShelfSource, FileShelfStashResult } from './shared'

interface UseFileShelfOptions {
  listenForDrops?: boolean
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function stashNotice(result: FileShelfStashResult) {
  const accepted = result.items.length
  const rejected = result.rejected.length
  if (accepted > 0 && rejected > 0) return `已暂存 ${accepted} 项，${rejected} 项未能加入`
  if (accepted > 0) return `已暂存 ${accepted} 项`
  if (rejected > 0) return result.rejected.map((item) => `${item.file_name}：${item.reason}`).join('；')
  return '没有找到可暂存的文件'
}

export function useFileShelf({ listenForDrops = false }: UseFileShelfOptions = {}) {
  const [items, setItems] = useState<FileShelfItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<'stashing' | 'copying' | 'removing' | 'revealing' | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const next = await invoke<FileShelfItem[]>('assistant_file_shelf_list')
      const safeItems = Array.isArray(next) ? next : []
      setItems(safeItems)
      setSelectedIds((current) => {
        const availableIds = new Set(safeItems.map((item) => item.id))
        return new Set([...current].filter((id) => availableIds.has(id)))
      })
      setError(null)
    } catch (loadError) {
      setError(messageOf(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
    let disposed = false
    let unlisten: (() => void) | undefined
    void safeListen('assistant://file-shelf-changed', () => { void reload() }).then((stop) => {
      if (disposed) stop()
      else unlisten = stop
    })
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [reload])

  const stashPaths = useCallback(async (paths: string[], sourceType: FileShelfSource = 'drag') => {
    if (paths.length === 0) return null
    setAction('stashing')
    setError(null)
    setNotice(null)
    try {
      const result = await invoke<FileShelfStashResult>('assistant_file_shelf_stash_paths', {
        paths,
        sourceType,
      })
      await reload()
      const message = stashNotice(result)
      if (result.items.length > 0) setNotice(message)
      if (result.rejected.length > 0) {
        setError(result.rejected.map((item) => `${item.file_name}：${item.reason}`).join('；'))
      }
      return result
    } catch (stashError) {
      setError(messageOf(stashError))
      return null
    } finally {
      setAction(null)
    }
  }, [reload])

  useEffect(() => {
    if (!listenForDrops) return
    let disposed = false
    let unlisten: (() => void) | undefined
    void safeOnDragDrop((event) => {
      if (event.payload.type === 'enter' || event.payload.type === 'over') setDragActive(true)
      if (event.payload.type === 'leave') setDragActive(false)
      if (event.payload.type === 'drop') {
        setDragActive(false)
        void stashPaths(event.payload.paths, 'drag')
      }
    }).then((stop) => {
      if (disposed) stop()
      else unlisten = stop
    })
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [listenForDrops, stashPaths])

  const stashClipboard = useCallback(async () => {
    setAction('stashing')
    setError(null)
    setNotice(null)
    try {
      const result = await invoke<FileShelfStashResult>('assistant_file_shelf_stash_clipboard')
      await reload()
      const message = stashNotice(result)
      if (result.items.length > 0) setNotice(message)
      if (result.rejected.length > 0) {
        setError(result.rejected.map((item) => `${item.file_name}：${item.reason}`).join('；'))
      }
      return result
    } catch (clipboardError) {
      setError(messageOf(clipboardError))
      return null
    } finally {
      setAction(null)
    }
  }, [reload])

  const chooseFiles = useCallback(async () => {
    const selected = await open({ multiple: true, directory: false })
    if (!selected) return null
    return stashPaths(Array.isArray(selected) ? selected : [selected], 'picker')
  }, [stashPaths])

  const toggleSelected = useCallback((itemId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }, [])

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  )

  const selectAll = useCallback(() => {
    setSelectedIds((current) => current.size === items.length
      ? new Set()
      : new Set(items.map((item) => item.id)))
  }, [items])

  const copySelected = useCallback(async () => {
    const itemIds = selectedItems.filter((item) => item.available).map((item) => item.id)
    if (itemIds.length === 0) return false
    setAction('copying')
    setError(null)
    setNotice(null)
    try {
      const count = await invoke<number>('assistant_file_shelf_copy', { itemIds })
      setNotice(`已复制 ${count} 项，切换到目标位置按 ⌘V 即可粘贴`)
      await reload()
      return true
    } catch (copyError) {
      setError(messageOf(copyError))
      return false
    } finally {
      setAction(null)
    }
  }, [reload, selectedItems])

  const removeSelected = useCallback(async () => {
    const itemIds = selectedItems.map((item) => item.id)
    if (itemIds.length === 0) return false
    setAction('removing')
    setError(null)
    setNotice(null)
    try {
      const count = await invoke<number>('assistant_file_shelf_remove', { itemIds })
      setSelectedIds(new Set())
      setNotice(`已移除 ${count} 个中转副本，原文件不受影响`)
      await reload()
      return true
    } catch (removeError) {
      setError(messageOf(removeError))
      return false
    } finally {
      setAction(null)
    }
  }, [reload, selectedItems])

  const reveal = useCallback(async (itemId: string) => {
    setAction('revealing')
    setError(null)
    try {
      await invoke('assistant_file_shelf_reveal', { itemId })
      return true
    } catch (revealError) {
      setError(messageOf(revealError))
      return false
    } finally {
      setAction(null)
    }
  }, [])

  return {
    items,
    selectedIds,
    selectedItems,
    loading,
    action,
    dragActive,
    error,
    notice,
    reload,
    stashPaths,
    stashClipboard,
    chooseFiles,
    toggleSelected,
    selectAll,
    clearSelection: () => setSelectedIds(new Set()),
    copySelected,
    removeSelected,
    reveal,
  }
}

export type UseFileShelf = ReturnType<typeof useFileShelf>
