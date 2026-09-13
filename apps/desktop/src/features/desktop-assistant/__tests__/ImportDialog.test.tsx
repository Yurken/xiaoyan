import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ImportDialog } from '../components/ImportDialog'

const themes = [{ id: 'theme-1', name: 'Graph RAG', asset_count: 3 }]

describe('ImportDialog', () => {
  it('confirms destination, theme, retention, source and storage before saving later', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ImportDialog
        content="A captured paragraph"
        originalContent="A captured paragraph"
        sourceLabel="剪贴板"
        themes={themes}
        defaultResearchThemeId="theme-1"
        defaultRetentionPolicy="7_days"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByText('来源：剪贴板')).toBeInTheDocument()
    expect(screen.getByText(/存储位置：小妍本地数据库/)).toBeInTheDocument()
    expect(screen.getByText(/预计占用：约/)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '研究主题' })).toHaveValue('theme-1')

    await user.click(screen.getByRole('button', { name: /稍后处理/ }))
    await user.selectOptions(screen.getByRole('combobox', { name: '保留时间' }), '30_days')
    await user.click(screen.getByRole('button', { name: '确认导入' }))

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      target: 'later',
      researchThemeId: 'theme-1',
      preserveOriginal: true,
      retentionPolicy: '30_days',
    }))
  })

  it('allows a generated result to retain the separate original text explicitly', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ImportDialog
        content="Translated result"
        originalContent="Original paragraph"
        themes={themes}
        defaultRetentionPolicy="7_days"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: '确认导入' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      target: 'note',
      preserveOriginal: true,
      retentionPolicy: 'permanent',
    }))
  })

  it('routes an interpreted screenshot back to the original image asset', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ImportDialog
        content="Chart interpretation"
        originalContent="data:image/png;base64,iVBORw0KGgo="
        themes={themes}
        defaultRetentionPolicy="7_days"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /图片资产/ }))
    expect(screen.getByText(/assistant_images/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(screen.getByRole('checkbox')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '确认导入' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      target: 'image',
      preserveOriginal: true,
      retentionPolicy: 'permanent',
    }))
  })

  it('can preserve an interpreted screenshot as a managed note attachment', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ImportDialog
        content="Chart interpretation"
        originalContent="data:image/png;base64,iVBORw0KGgo="
        themes={themes}
        defaultRetentionPolicy="7_days"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('checkbox'))
    expect(screen.getByText(/删除笔记时同步清理/)).toBeInTheDocument()
    expect(screen.getByText(/assistant_note_attachments/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认导入' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      target: 'note',
      preserveOriginal: true,
    }))
  })
})
