import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AssistantInboxWorkspace } from '../components/AssistantInboxWorkspace'
import type { UseAssistantInbox } from '../hooks/useAssistantInbox'

function controller(): UseAssistantInbox {
  return {
    overview: {
      later_items: [{
        id: 'later-1', title: '待整理结论', content_preview: '这是一段研究结论',
        research_theme_id: 'theme-1', research_theme_name: '可信 AI',
        source_type: 'selection', source_app: 'Safari', window_title: 'Paper',
        retention_policy: '7_days', expires_at: '2026-08-05 10:00:00', created_at: '2026-07-29 10:00:00',
      }],
      paper_candidates: [
        { id: 'paper-1', title: 'Reliable Agents', file_name: 'paper.pdf', file_size_bytes: 2048, has_source_file: true, created_at: '2026-07-29 10:00:00' },
        { id: 'paper-2', title: '仅有文本的候选', file_name: null, file_size_bytes: null, has_source_file: false, created_at: '2026-07-29 10:00:00' },
      ],
      file_candidates: [{
        id: 'file-1', file_name: 'notes.md', kind: 'markdown', media_type: 'text/markdown',
        size_bytes: 1024, recommended_target: 'note', expires_at: '2026-07-30 10:00:00', created_at: '2026-07-29 10:00:00',
      }],
    },
    themes: [{ id: 'theme-1', name: '可信 AI', asset_count: 3 }],
    selectedThemeId: '',
    loading: false,
    activeItemId: null,
    error: null,
    notice: null,
    setSelectedThemeId: vi.fn(),
    reload: vi.fn(),
    convertLater: vi.fn(),
    importPaper: vi.fn(),
    importFile: vi.fn(),
    discard: vi.fn(),
  }
}

describe('AssistantInboxWorkspace', () => {
  it('shows provenance and routes each supported candidate to its real action', async () => {
    const user = userEvent.setup()
    const value = controller()
    render(<AssistantInboxWorkspace controller={value} />)

    expect(screen.getByText(/Safari · Paper · 可信 AI · 到期/)).toBeInTheDocument()
    expect(screen.getByText('paper.pdf · 2.0 KB')).toBeInTheDocument()
    expect(screen.getByText(/尚未关联 PDF/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '导入论文库' })[1]).toBeDisabled()

    await user.click(screen.getAllByRole('button', { name: '转为笔记' })[0])
    expect(value.convertLater).toHaveBeenCalledWith('later-1')
    await user.click(screen.getAllByRole('button', { name: '导入论文库' })[0])
    expect(value.importPaper).toHaveBeenCalledWith('paper-1')
    await user.click(screen.getAllByRole('button', { name: '转为笔记' })[1])
    expect(value.importFile).toHaveBeenCalledWith('file-1', 'note')
  })

  it('shows a clear empty state', () => {
    const value = controller()
    value.overview = { later_items: [], paper_candidates: [], file_candidates: [] }
    render(<AssistantInboxWorkspace controller={value} />)
    expect(screen.getByText('收集箱已经清空')).toBeInTheDocument()
  })
})
