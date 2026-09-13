import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { useAssistantPrivacyPreferences } from '../hooks/useAssistantPrivacyPreferences'

describe('useAssistantPrivacyPreferences', () => {
  beforeEach(() => resetInvokeMock())

  it('loads and persists application privacy rules', async () => {
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_get_privacy_preferences') {
        return {
          allowed_apps: [],
          blocked_apps: ['com.example.private'],
          window_title_enabled: false,
        }
      }
      if (command === 'assistant_set_privacy_preferences') {
        expect(args).toEqual({
          allowedApps: ['com.apple.Safari'],
          blockedApps: ['com.example.private'],
          windowTitleEnabled: true,
        })
        return {
          allowed_apps: ['com.apple.Safari'],
          blocked_apps: ['com.example.private'],
          window_title_enabled: true,
        }
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useAssistantPrivacyPreferences())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.preferences.blocked_apps).toEqual(['com.example.private'])

    let saved = false
    await act(async () => {
      saved = await result.current.save({
        allowed_apps: ['com.apple.Safari'],
        blocked_apps: ['com.example.private'],
        window_title_enabled: true,
      })
    })

    expect(saved).toBe(true)
    expect(result.current.preferences.allowed_apps).toEqual(['com.apple.Safari'])
    expect(result.current.error).toBeNull()
  })

  it('keeps the loaded preferences when saving fails', async () => {
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_get_privacy_preferences') {
        return { allowed_apps: [], blocked_apps: [], window_title_enabled: false }
      }
      if (command === 'assistant_set_privacy_preferences') {
        throw new Error('应用标识格式无效')
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useAssistantPrivacyPreferences())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.save({
        allowed_apps: ['invalid bundle id'],
        blocked_apps: [],
        window_title_enabled: false,
      })
    })

    expect(result.current.preferences).toEqual({
      allowed_apps: [],
      blocked_apps: [],
      window_title_enabled: false,
    })
    expect(result.current.error).toContain('格式无效')
  })
})
