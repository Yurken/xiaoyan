import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AssistantImageAssetsPanel } from '../components/AssistantImageAssetsPanel'
import type { UseAssistantImageAssets } from '../hooks/useAssistantImageAssets'

function controller(): UseAssistantImageAssets {
  return {
    assets: [{
      id: 'asset-1', media_type: 'image/png', size_bytes: 2048, available: true,
      created_at: '2026-07-30 10:00:00', source_type: 'screenshot', source_app: 'Preview',
      source_app_bundle_id: 'com.apple.Preview', window_title: 'Figure 2', source_title: '结果图',
      source_url: 'https://example.com/paper', captured_at: '2026-07-30T10:00:00Z',
      capture_region: { x: null, y: null, width: 1280, height: 720 },
    }],
    loading: false,
    activeAssetId: null,
    error: null,
    notice: null,
    reload: vi.fn(),
    saveSource: vi.fn().mockResolvedValue(true),
    deleteAsset: vi.fn().mockResolvedValue(true),
  }
}

describe('AssistantImageAssetsPanel', () => {
  it('shows asset provenance and saves source edits', async () => {
    const user = userEvent.setup()
    const value = controller()
    render(<AssistantImageAssetsPanel controller={value} />)
    const createdAt = new Date('2026-07-30T10:00:00Z').toLocaleString('zh-CN')
    expect(screen.getByText(`image/png · 2.0 KB · ${createdAt}`)).toBeInTheDocument()
    expect(screen.getByText('1280 × 720 像素')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '编辑 结果图 的来源' }))
    const title = screen.getByRole('textbox', { name: '结果图 来源标题' })
    await user.clear(title)
    await user.type(title, '更新后的图题')
    await user.click(screen.getByRole('button', { name: '保存来源' }))
    expect(value.saveSource).toHaveBeenCalledWith('asset-1', expect.objectContaining({
      sourceTitle: '更新后的图题',
    }))
  })

  it('requires an inline confirmation before deleting the managed file', async () => {
    const user = userEvent.setup()
    const value = controller()
    render(<AssistantImageAssetsPanel controller={value} />)
    await user.click(screen.getByRole('button', { name: '删除图片 结果图' }))
    expect(screen.getByText(/将删除受管本地文件及其来源记录/)).toBeInTheDocument()
    expect(value.deleteAsset).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '确认删除' }))
    expect(value.deleteAsset).toHaveBeenCalledWith('asset-1')
  })

  it('renders missing-file and empty states without exposing a local path', () => {
    const value = controller()
    value.assets[0].available = false
    const { rerender } = render(<AssistantImageAssetsPanel controller={value} />)
    expect(screen.getByText('文件缺失')).toBeInTheDocument()
    expect(screen.queryByText(/assistant_images/)).not.toBeInTheDocument()

    value.assets = []
    rerender(<AssistantImageAssetsPanel controller={value} />)
    expect(screen.getByText('尚未保存图片资产。')).toBeInTheDocument()
  })
})
