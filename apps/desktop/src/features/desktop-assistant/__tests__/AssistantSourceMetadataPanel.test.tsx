import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AssistantSourceMetadataPanel } from '../components/AssistantSourceMetadataPanel'
import type { UseAssistantSourceMetadata } from '../hooks/useAssistantSourceMetadata'

function controller(): UseAssistantSourceMetadata {
  return {
    metadata: {
      import_id: 'import-1', target: 'note', target_id: 'note-1', source_type: 'screenshot',
      source_app: 'Preview', source_app_bundle_id: 'com.apple.Preview', window_title: 'Figure 2',
      source_title: '结果图', source_url: 'https://example.com/paper', captured_at: '2026-07-30T10:00:00Z',
      capture_region: { x: null, y: null, width: 1280, height: 720 },
      attachments: [{ id: 'asset-1', kind: 'screenshot', media_type: 'image/png', size_bytes: 2048 }],
    },
    loading: false,
    saving: false,
    error: null,
    reload: vi.fn(),
    save: vi.fn().mockResolvedValue(true),
  }
}

describe('AssistantSourceMetadataPanel', () => {
  it('shows screenshot provenance and saves user-edited source fields', async () => {
    const user = userEvent.setup()
    const value = controller()
    render(<AssistantSourceMetadataPanel controller={value} />)
    await user.click(screen.getByRole('button', { name: /来源：结果图/ }))
    expect(screen.getByText(/1280 × 720 像素/)).toBeInTheDocument()
    expect(screen.getByText(/原始截图附件 · 2.0 KB/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '编辑来源' }))
    await user.clear(screen.getByRole('textbox', { name: '来源标题' }))
    await user.type(screen.getByRole('textbox', { name: '来源标题' }), '更新后的图题')
    await user.click(screen.getByRole('button', { name: '保存来源' }))
    expect(value.save).toHaveBeenCalledWith(expect.objectContaining({ sourceTitle: '更新后的图题' }))
  })

  it('renders backend validation errors', () => {
    const value = controller()
    value.error = '来源链接仅支持 HTTP 或 HTTPS'
    render(<AssistantSourceMetadataPanel controller={value} />)
    expect(screen.getByRole('alert')).toHaveTextContent('来源链接仅支持 HTTP 或 HTTPS')
  })
})
