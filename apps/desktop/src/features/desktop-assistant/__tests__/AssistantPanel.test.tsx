import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AssistantPanel } from '../components/AssistantPanel'
import type { CaptureSession } from '../shared'

const imageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg=='

const baseSession: CaptureSession = {
  id: 'capture-1',
  sourceType: 'selection',
  content: '一段已确认的研究内容',
  screenshotPath: null,
  sourceApp: 'Preview',
  sourceAppBundleId: 'com.apple.Preview',
  windowTitle: '论文.pdf',
  createdAt: Date.now(),
  expiresAt: Date.now() + 60_000,
  status: 'ready',
  userConfirmed: true,
}

function renderPanel(session: CaptureSession | null, isLoading = false) {
  render(
    <AssistantPanel
      session={session}
      isLoading={isLoading}
      onAction={vi.fn()}
      translationPreferences={{ target_language: 'en', terminology_style: 'bilingual' }}
      onTranslationPreferencesChange={vi.fn()}
      knowledgeThemes={[]}
      localKnowledgeEnabled={false}
      knowledgeThemeId=""
      onLocalKnowledgeEnabledChange={vi.fn()}
      onKnowledgeThemeChange={vi.fn()}
      onSourceChange={vi.fn()}
      onClose={vi.fn()}
    />,
  )
}

describe('AssistantPanel capture summary', () => {
  it('shows a bounded screenshot preview with source and pixel dimensions', () => {
    renderPanel({
      ...baseSession,
      sourceType: 'screenshot',
      content: imageDataUrl,
      screenshotPath: imageDataUrl,
      captureRegion: { x: -1280, y: 40, width: 1280, height: 720 },
    })

    const preview = screen.getByRole('img', { name: '当前截图预览' })
    expect(preview).toHaveAttribute('src', imageDataUrl)
    expect(preview).toHaveClass('max-h-40')
    expect(screen.getByText('区域截图')).toBeInTheDocument()
    expect(screen.getByText('截图范围：1280 × 720 像素')).toBeInTheDocument()
    expect(screen.getByText('来源：Preview - 论文.pdf')).toBeInTheDocument()
    expect(screen.queryByText(imageDataUrl)).not.toBeInTheDocument()
  })

  it('keeps the confirmed text preview and character count', () => {
    renderPanel({ ...baseSession, contentTruncated: true })

    expect(screen.getByText('一段已确认的研究内容')).toBeInTheDocument()
    expect(screen.getByText(/10 字符；采集时已按 50,000 字符上限截断/))
      .toBeInTheDocument()
    expect(screen.getByText('来源：Preview - 论文.pdf')).toBeInTheDocument()
  })

  it('previews image content when a separate screenshot path is absent', () => {
    renderPanel({ ...baseSession, sourceType: 'paste', content: imageDataUrl })

    expect(screen.getByRole('img', { name: '当前截图预览' }))
      .toHaveAttribute('src', imageDataUrl)
    expect(screen.queryByText(imageDataUrl)).not.toBeInTheDocument()
    expect(screen.queryByText('区域截图')).not.toBeInTheDocument()
    expect(screen.queryByText(/字符/)).not.toBeInTheDocument()
  })

  it('shows extracted text instead of a retained original screenshot', () => {
    renderPanel({
      ...baseSession,
      sourceType: 'screenshot',
      screenshotPath: imageDataUrl,
      captureRegion: { x: 0, y: 0, width: 1280, height: 720 },
    })

    expect(screen.getByText('一段已确认的研究内容')).toBeInTheDocument()
    expect(screen.getByText('10 字符')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: '当前截图预览' })).not.toBeInTheDocument()
    expect(screen.queryByText(/截图范围/)).not.toBeInTheDocument()
  })

  it('keeps the loading and empty states', () => {
    const { rerender } = render(
      <AssistantPanel
        session={null}
        isLoading
        onAction={vi.fn()}
        translationPreferences={{ target_language: 'en', terminology_style: 'bilingual' }}
        onTranslationPreferencesChange={vi.fn()}
        knowledgeThemes={[]}
        localKnowledgeEnabled={false}
        knowledgeThemeId=""
        onLocalKnowledgeEnabledChange={vi.fn()}
        onKnowledgeThemeChange={vi.fn()}
        onSourceChange={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('获取中...')).toBeInTheDocument()
    rerender(
      <AssistantPanel
        session={null}
        onAction={vi.fn()}
        translationPreferences={{ target_language: 'en', terminology_style: 'bilingual' }}
        onTranslationPreferencesChange={vi.fn()}
        knowledgeThemes={[]}
        localKnowledgeEnabled={false}
        knowledgeThemeId=""
        onLocalKnowledgeEnabledChange={vi.fn()}
        onKnowledgeThemeChange={vi.fn()}
        onSourceChange={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('请先获取内容...')).toBeInTheDocument()
  })
})
