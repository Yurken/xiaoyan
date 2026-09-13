import { act, render, screen } from '@testing-library/react'
import { listen } from '@tauri-apps/api/event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { COPILOT_LAST_SESSION_KEY } from '../../copilot/sessionKeys'
import { useAssistantConversationHandoff } from '../hooks/useAssistantConversationHandoff'

type TestEventHandler = (event: { payload: unknown }) => void
let handoffHandler: TestEventHandler | undefined

function Probe() {
  useAssistantConversationHandoff()
  const location = useLocation()
  const state = location.state as { assistantConversationId?: string } | null
  return (
    <div>
      <span>{location.pathname}</span>
      <span>{state?.assistantConversationId}</span>
    </div>
  )
}

describe('useAssistantConversationHandoff', () => {
  beforeEach(() => {
    localStorage.clear()
    handoffHandler = undefined
    vi.mocked(listen).mockReset()
    vi.mocked(listen).mockImplementation(async (_event, handler) => {
      handoffHandler = handler as unknown as TestEventHandler
      return () => {
        handoffHandler = undefined
      }
    })
  })

  it('selects the promoted conversation and navigates the main window to chat', async () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Probe />
      </MemoryRouter>,
    )
    await act(async () => {})
    act(() => {
      handoffHandler?.({
        payload: { conversation_id: 'assistant-session-1' },
      })
    })

    expect(screen.getByText('/chat')).toBeInTheDocument()
    expect(screen.getByText('assistant-session-1')).toBeInTheDocument()
    expect(localStorage.getItem(COPILOT_LAST_SESSION_KEY)).toBe(
      'assistant-session-1',
    )
  })
})
