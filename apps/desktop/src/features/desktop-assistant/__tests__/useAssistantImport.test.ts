import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { useAssistantImport } from '../hooks/useAssistantImport'

describe('useAssistantImport', () => {
  beforeEach(() => resetInvokeMock())

  it('sends the confirmed import contract and separate original only when requested', async () => {
    getInvokeMock().mockResolvedValue({ id: 'note-1' })
    const { result } = renderHook(() => useAssistantImport())

    await act(async () => {
      result.current.show()
    })
    await act(async () => {
      expect(await result.current.confirm({
        sessionId: 'session-1',
        content: 'Generated result',
        originalContent: 'Original paragraph',
        config: {
          target: 'note',
          researchThemeId: 'theme-1',
          preserveOriginal: true,
          retentionPolicy: 'permanent',
        },
      })).toBe(true)
    })

    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_import', {
      sessionId: 'session-1',
      content: 'Generated result',
      target: 'note',
      title: null,
      tags: null,
      researchThemeId: 'theme-1',
      preserveOriginal: true,
      originalContent: 'Original paragraph',
      retentionPolicy: 'permanent',
    })
    expect(result.current.open).toBe(false)
  })

  it('uses the captured image as content for an image asset', async () => {
    getInvokeMock().mockResolvedValue({ id: 'image-1' })
    const { result } = renderHook(() => useAssistantImport())
    await act(async () => {
      await result.current.confirm({
        sessionId: 'session-image',
        content: 'Chart interpretation',
        originalContent: 'data:image/png;base64,iVBORw0KGgo=',
        config: {
          target: 'image',
          preserveOriginal: true,
          retentionPolicy: 'permanent',
        },
      })
    })
    expect(getInvokeMock()).toHaveBeenCalledWith(
      'assistant_import',
      expect.objectContaining({
        content: 'data:image/png;base64,iVBORw0KGgo=',
        originalContent: null,
      }),
    )
  })
})
