import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { useAssistantOnboarding } from '../hooks/useAssistantOnboarding'

const onboardingEvent = vi.hoisted(() => ({
  handler: null as null | ((event: {
    payload: { permission_guide_completed: boolean }
  }) => void),
  listen: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: onboardingEvent.listen,
}))

describe('useAssistantOnboarding', () => {
  beforeEach(() => {
    resetInvokeMock()
    onboardingEvent.handler = null
    onboardingEvent.listen.mockReset()
    onboardingEvent.listen.mockImplementation(async (_event, handler) => {
      onboardingEvent.handler = handler
      return vi.fn()
    })
  })

  it('persists an explicit completion so the guide does not loop', async () => {
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_get_onboarding') {
        return { permission_guide_completed: false }
      }
      if (command === 'assistant_complete_permission_guide') {
        return { permission_guide_completed: true }
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useAssistantOnboarding())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.onboarding.permission_guide_completed).toBe(false)

    await act(async () => {
      await result.current.completePermissionGuide()
    })
    expect(result.current.onboarding.permission_guide_completed).toBe(true)
    expect(getInvokeMock()).toHaveBeenCalledTimes(2)
  })

  it('synchronizes completion from another window', async () => {
    getInvokeMock().mockResolvedValue({ permission_guide_completed: false })
    const { result } = renderHook(() => useAssistantOnboarding())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(onboardingEvent.handler).not.toBeNull())

    act(() => {
      onboardingEvent.handler?.({
        payload: { permission_guide_completed: true },
      })
    })
    expect(result.current.onboarding.permission_guide_completed).toBe(true)
  })
})
