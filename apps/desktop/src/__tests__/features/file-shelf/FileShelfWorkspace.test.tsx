import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FileShelfWorkspace } from '../../../features/file-shelf/FileShelfWorkspace'
import type { UseFileShelf } from '../../../features/file-shelf/useFileShelf'

function controller(): UseFileShelf {
  const item = {
    id: '11111111-1111-4111-8111-111111111111',
    file_name: 'experiment-data.csv',
    is_directory: false,
    size_bytes: 4096,
    source_type: 'clipboard' as const,
    available: true,
    created_at: '2026-09-13 10:00:00',
    last_copied_at: null,
  }
  return {
    items: [item],
    selectedIds: new Set([item.id]),
    selectedItems: [item],
    loading: false,
    action: null,
    dragActive: false,
    error: null,
    notice: null,
    reload: vi.fn(),
    stashPaths: vi.fn(),
    stashClipboard: vi.fn(),
    chooseFiles: vi.fn(),
    toggleSelected: vi.fn(),
    selectAll: vi.fn(),
    clearSelection: vi.fn(),
    copySelected: vi.fn(),
    removeSelected: vi.fn(),
    reveal: vi.fn(),
  }
}

describe('FileShelfWorkspace', () => {
  it('presents the shelf as the primary inbox action and copies a multi-selection', async () => {
    const user = userEvent.setup()
    const value = controller()
    render(<FileShelfWorkspace controller={value} />)

    expect(screen.getByRole('heading', { name: '文件中转站' })).toBeInTheDocument()
    expect(screen.getByText('experiment-data.csv')).toBeInTheDocument()
    expect(screen.getByText(/来自剪贴板/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '复制所选' }))
    expect(value.copySelected).toHaveBeenCalled()
  })

  it('teaches both drag and clipboard entry points in the empty state', () => {
    const value = controller()
    value.items = []
    value.selectedIds = new Set()
    value.selectedItems = []
    render(<FileShelfWorkspace controller={value} />)
    expect(screen.getByText(/拖到桌面小妍会直接暂存/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /粘贴剪贴板/ })).toBeInTheDocument()
  })
})
