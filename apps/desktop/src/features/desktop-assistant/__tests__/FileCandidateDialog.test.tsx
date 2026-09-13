import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FileCandidateDialog } from '../components/FileCandidateDialog'

const candidate = {
  id: 'candidate-1',
  file_name: 'paper.pdf',
  kind: 'pdf',
  media_type: 'application/pdf',
  size_bytes: 1_048_576,
  recommended_target: 'paper',
} as const

describe('FileCandidateDialog', () => {
  it('shows accepted and rejected files and waits for explicit confirmation', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(
      <FileCandidateDialog
        inspection={{
          candidates: [candidate],
          rejected: [{ file_name: 'archive.zip', reason: '不支持该类型' }],
        }}
        confirmedCandidates={null}
        confirming={false}
        error={null}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        onCloseConfirmation={vi.fn()}
      />,
    )

    expect(screen.getByText('paper.pdf')).toBeInTheDocument()
    expect(screen.getByText(/1.0 MB · 论文导入候选/)).toBeInTheDocument()
    expect(screen.getByText(/archive.zip：不支持该类型/)).toBeInTheDocument()
    expect(screen.getByText(/不会立即解析、上传、移动或修改原文件/)).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '确认创建候选' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('shows the confirmed candidate result', () => {
    render(
      <FileCandidateDialog
        inspection={null}
        confirmedCandidates={[candidate]}
        confirming={false}
        error={null}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onCloseConfirmation={vi.fn()}
      />,
    )

    expect(screen.getByText('文件候选已创建')).toBeInTheDocument()
    expect(screen.getByText(/已创建 1 个待导入候选/)).toBeInTheDocument()
  })

  it('keeps inspection failures visible and dismissible', () => {
    render(
      <FileCandidateDialog
        inspection={null}
        confirmedCandidates={null}
        confirming={false}
        error="候选检查失败"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onCloseConfirmation={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('候选检查失败')
    expect(screen.getByRole('button', { name: '取消' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '确认创建候选' })).toBeDisabled()
  })
})
