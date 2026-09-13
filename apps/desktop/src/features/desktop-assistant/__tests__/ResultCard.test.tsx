import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ResultCard } from '../components/ResultCard'

const streamingResult = {
  id: 'result-1',
  sessionId: 'session-1',
  action: 'interpret',
  content: '已经生成的部分',
  format: 'markdown',
  createdAt: Date.now(),
} as const

describe('ResultCard', () => {
  it('offers stop during streaming while keeping partial output actionable', async () => {
    const user = userEvent.setup()
    const onStop = vi.fn()
    const onCopy = vi.fn()
    render(
      <ResultCard
        result={streamingResult}
        status="streaming"
        onStop={onStop}
        onCopy={onCopy}
        onImport={vi.fn()}
      />,
    )

    expect(screen.getByText('已经生成的部分')).toBeInTheDocument()
    expect(screen.getByText('生成中')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '停止' }))
    await user.click(screen.getByRole('button', { name: '复制' }))

    expect(onStop).toHaveBeenCalledOnce()
    expect(onCopy).toHaveBeenCalledWith('已经生成的部分')
  })

  it('labels estimated token metadata explicitly', () => {
    render(
      <ResultCard
        result={{
          ...streamingResult,
          metadata: {
            model: 'research-model',
            tokenUsage: 42,
            tokenUsageEstimated: true,
            duration: 1200,
          },
        }}
        status="completed"
        onCopy={vi.fn()}
        onImport={vi.fn()}
      />,
    )

    expect(screen.getByText('模型：research-model')).toBeInTheDocument()
    expect(screen.getByText('约 42 Token')).toBeInTheDocument()
    expect(screen.getByText('耗时：1.2s')).toBeInTheDocument()
  })

  it('shows the selected local theme and structured citation sources', () => {
    render(
      <ResultCard
        result={{
          ...streamingResult,
          metadata: {
            knowledgeTheme: 'Graph RAG',
            sourceDetails: [
              {
                sourceType: 'paper',
                sourceId: 'paper-1',
                title: 'Graph Retrieval',
              },
              {
                sourceType: 'wiki',
                sourceId: 'wiki-1',
                title: 'Reviewed Graph Wiki · Method',
              },
            ],
          },
        }}
        status="completed"
        onCopy={vi.fn()}
        onImport={vi.fn()}
      />,
    )

    expect(screen.getByText('本地知识 · Graph RAG')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: '本地知识引用来源' })).toBeInTheDocument()
    expect(screen.getByText('Graph Retrieval')).toBeInTheDocument()
    expect(screen.getByText('内部 Wiki')).toBeInTheDocument()
  })

  it('allows each active temporary context item to be removed explicitly', async () => {
    const user = userEvent.setup()
    const onRemoveCaptureContext = vi.fn()
    const onRemoveLocalKnowledge = vi.fn()
    render(
      <ResultCard
        result={streamingResult}
        status="completed"
        onCopy={vi.fn()}
        onImport={vi.fn()}
        captureContextLabel="剪贴板"
        includeCaptureContext
        useLocalKnowledge
        hadLocalKnowledge
        knowledgeThemeName="Graph RAG"
        onRemoveCaptureContext={onRemoveCaptureContext}
        onRemoveLocalKnowledge={onRemoveLocalKnowledge}
      />,
    )

    expect(screen.getByText('剪贴板')).toBeInTheDocument()
    expect(screen.getByText('本地知识 · Graph RAG')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '移除捕获内容' }))
    await user.click(screen.getByRole('button', { name: '移除本地知识' }))
    expect(onRemoveCaptureContext).toHaveBeenCalledOnce()
    expect(onRemoveLocalKnowledge).toHaveBeenCalledOnce()
  })

  it('renders markdown structure instead of showing markdown markers as plain text', () => {
    render(
      <ResultCard
        result={{
          ...streamingResult,
          content: '## 核心结论\n\n- 第一项\n- 第二项\n\n`term`',
        }}
        status="completed"
        onCopy={vi.fn()}
        onImport={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: '核心结论', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getByText('term').tagName).toBe('CODE')
  })

  it('copies source and translation together only on explicit user action', async () => {
    const user = userEvent.setup()
    const onCopy = vi.fn()
    render(
      <ResultCard
        result={{
          ...streamingResult,
          action: 'translate',
          content: '译文内容',
        }}
        sourceContent="Source text"
        status="completed"
        onCopy={onCopy}
        onImport={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: '双语复制' }))
    expect(onCopy).toHaveBeenCalledWith(
      '## 原文\n\nSource text\n\n---\n\n## 译文\n\n译文内容',
    )
  })

  it('allows a chosen translation to be saved and an existing preference removed', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(true)
    const onRemove = vi.fn().mockResolvedValue(true)
    render(
      <ResultCard
        result={{
          ...streamingResult,
          action: 'translate',
          content: '译文内容',
        }}
        status="completed"
        onCopy={vi.fn()}
        onImport={vi.fn()}
        translationTargetLanguage="zh"
        terminologyPreferences={[{
          source_term: 'retrieval',
          preferred_translation: '检索',
          target_language: 'zh',
          updated_at: '2026-07-29T00:00:00Z',
        }]}
        onSaveTerminologyPreference={onSave}
        onRemoveTerminologyPreference={onRemove}
      />,
    )

    await user.type(screen.getByRole('textbox', { name: '原术语' }), 'agent')
    await user.type(screen.getByRole('textbox', { name: '选定译法' }), '智能体')
    await user.click(screen.getByRole('button', { name: '保存术语偏好' }))
    expect(onSave).toHaveBeenCalledWith('agent', '智能体', 'zh')

    await user.click(screen.getByRole('button', { name: '删除术语偏好：retrieval' }))
    expect(onRemove).toHaveBeenCalledWith('retrieval', 'zh')
  })

  it('labels the expand icon button for screen readers', () => {
    render(
      <ResultCard
        result={streamingResult}
        status="completed"
        onCopy={vi.fn()}
        onImport={vi.fn()}
        onExpand={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: '展开结果' })).toBeInTheDocument()
  })

  it('marks the streaming placeholder as a polite live region', () => {
    render(
      <ResultCard
        result={{ ...streamingResult, content: '' }}
        status="streaming"
        onCopy={vi.fn()}
        onImport={vi.fn()}
        onStop={vi.fn()}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('正在生成…')
  })
})
