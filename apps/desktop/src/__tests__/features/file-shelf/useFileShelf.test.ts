import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../mocks/tauri'
import { useFileShelf } from '../../../features/file-shelf/useFileShelf'

const shelfItem = {
  id: '11111111-1111-4111-8111-111111111111',
  file_name: 'paper.pdf',
  is_directory: false,
  size_bytes: 2048,
  source_type: 'drag',
  available: true,
  created_at: '2026-09-13 10:00:00',
  last_copied_at: null,
}

describe('useFileShelf', () => {
  beforeEach(() => {
    resetInvokeMock()
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_file_shelf_list') return [shelfItem]
      if (command === 'assistant_file_shelf_copy') return 1
      if (command === 'assistant_file_shelf_remove') return 1
      if (command === 'assistant_file_shelf_stash_clipboard') {
        return { items: [shelfItem], rejected: [] }
      }
      return undefined
    })
  })

  it('loads, multi-selects, and copies staged files back to the system clipboard', async () => {
    const { result } = renderHook(() => useFileShelf())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.toggleSelected(shelfItem.id))
    await act(async () => { await result.current.copySelected() })

    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_file_shelf_copy', {
      itemIds: [shelfItem.id],
    })
    expect(result.current.notice).toContain('切换到目标位置按 ⌘V')
  })

  it('imports copied Finder files through the native clipboard command', async () => {
    const { result } = renderHook(() => useFileShelf())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.stashClipboard() })
    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_file_shelf_stash_clipboard')
    expect(result.current.notice).toBe('已暂存 1 项')
  })
})
