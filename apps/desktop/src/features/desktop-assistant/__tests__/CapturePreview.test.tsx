import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CapturePreview } from '../components/CapturePreview'
import type { CaptureSession } from '../shared'

const baseSession: CaptureSession = {
  id: 'capture-1',
  sourceType: 'clipboard',
  content: '联系 [EMAIL]',
  screenshotPath: null,
  sourceApp: null,
  sourceAppBundleId: null,
  windowTitle: null,
  createdAt: Date.now(),
  expiresAt: Date.now() + 60_000,
  status: 'ready',
  userConfirmed: false,
  sensitiveRedactionKinds: ['邮箱'],
  sensitiveConfirmationArmed: false,
}

function renderPreview(session: CaptureSession) {
  render(
    <CapturePreview
      session={session}
      privacyError={null}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
      onRetry={vi.fn()}
      onEdit={vi.fn()}
      onPasteFallback={vi.fn()}
    />,
  )
}

describe('CapturePreview', () => {
  it('explains default redaction without rendering the original value', () => {
    renderPreview(baseSession)
    expect(screen.getByRole('alert')).toHaveTextContent('检测到：邮箱')
    expect(screen.getByDisplayValue('联系 [EMAIL]')).toBeInTheDocument()
    expect(screen.queryByText(/researcher@example\.com/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '检查后继续' })).toBeInTheDocument()
  })

  it('labels the irreversible second confirmation explicitly', () => {
    renderPreview({ ...baseSession, sensitiveConfirmationArmed: true })
    expect(screen.getByRole('button', { name: '确认发送遮盖内容' })).toBeInTheDocument()
  })

  it('announces the preset direct action that runs after confirmation', () => {
    render(
      <CapturePreview
        session={{ ...baseSession, sensitiveRedactionKinds: [] }}
        privacyError={null}
        pendingAction="interpret"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onRetry={vi.fn()}
        onEdit={vi.fn()}
        onPasteFallback={vi.fn()}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('确认后将直接执行：解读')
  })

  it('hides the direct action hint while a privacy error blocks the preview', () => {
    render(
      <CapturePreview
        session={{ ...baseSession, status: 'error' }}
        privacyError="内容被隐私策略阻止"
        pendingAction="translate"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onRetry={vi.fn()}
        onEdit={vi.fn()}
        onPasteFallback={vi.fn()}
      />,
    )
    expect(screen.queryByText(/确认后将直接执行/)).not.toBeInTheDocument()
  })
})
