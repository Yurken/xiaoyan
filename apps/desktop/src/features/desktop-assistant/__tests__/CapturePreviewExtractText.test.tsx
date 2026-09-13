import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CapturePreview } from '../components/CapturePreview'
import type { CaptureSession } from '../shared'

const ocrSession: CaptureSession = {
  id: 'screenshot-1',
  sourceType: 'screenshot',
  content: '截图中提取的文字',
  screenshotPath: 'data:image/png;base64,iVBORw0KGgo=',
  sourceApp: 'Preview',
  sourceAppBundleId: 'com.apple.Preview',
  windowTitle: null,
  createdAt: Date.now(),
  expiresAt: Date.now() + 60_000,
  status: 'ready',
  userConfirmed: false,
  sensitiveRedactionKinds: [],
  sensitiveConfirmationArmed: false,
}

function renderPreview(extractedFromImage: boolean) {
  render(
    <CapturePreview
      session={ocrSession}
      privacyError={null}
      extractedFromImage={extractedFromImage}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
      onRetry={vi.fn()}
      onEdit={vi.fn()}
      onPasteFallback={vi.fn()}
    />,
  )
}

describe('CapturePreview OCR 提取结果', () => {
  it('labels extracted text as possibly wrong and keeps it editable', () => {
    renderPreview(true)
    // PRD §7.2 F3：OCR 结果必须标注「识别可能有误」。
    expect(screen.getByText(/识别可能有误/)).toBeInTheDocument()
    // 截图来源的 OCR 文本也进入可编辑预览，而不是只读图片。
    expect(screen.getByDisplayValue('截图中提取的文字')).toBeInTheDocument()
    // 原截图仍可见，便于用户对照核对。
    expect(screen.getByAltText('截图预览')).toBeInTheDocument()
  })

  it('keeps plain screenshots image-only without the OCR notice', () => {
    renderPreview(false)
    expect(screen.queryByText(/识别可能有误/)).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('截图中提取的文字')).not.toBeInTheDocument()
    expect(screen.getByAltText('截图预览')).toBeInTheDocument()
  })
})
