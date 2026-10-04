import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../../../features/settings/pageConfig'
import { useSettingsController } from '../../../features/settings/useSettingsController'

const { getSettings, updateSettings, getVersion } = vi.hoisted(() => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  getVersion: vi.fn(),
}))

vi.mock('../../../lib/client', () => ({
  apiClient: { settings: { get: getSettings, update: updateSettings } },
  formatErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
}))
vi.mock('@tauri-apps/api/app', () => ({ getVersion }))

const savedSettings = { ...DEFAULT_SETTINGS, openai_chat_model: 'saved-model' }

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

async function advance(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

async function renderController() {
  const hook = renderHook(() => useSettingsController(DEFAULT_SETTINGS))
  await act(async () => {})
  return hook
}

describe('settings persistence reliability', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    getSettings.mockReset().mockResolvedValue(savedSettings)
    updateSettings.mockReset().mockResolvedValue(undefined)
    getVersion.mockReset().mockResolvedValue('0.6.0-dev.1')
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('never writes defaults after loading existing settings fails', async () => {
    getSettings.mockRejectedValue(new Error('读取配置失败'))
    const { result } = await renderController()

    expect(result.current.loadError).toBe('读取配置失败')
    await advance(5000)
    await act(async () => { await result.current.handleSaveSettings() })
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it('keeps loaded settings usable when version metadata is unavailable', async () => {
    getVersion.mockRejectedValue(new Error('版本信息暂不可用'))
    const { result } = await renderController()

    expect(result.current.form.openai_chat_model).toBe('saved-model')
    expect(result.current.loadError).toBe('')
    await advance(1000)
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it('serializes saves and persists the latest edit after the pending save', async () => {
    const first = deferred()
    const second = deferred()
    updateSettings.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result } = await renderController()

    act(() => { result.current.set('openai_chat_model')('first-edit') })
    await advance(700)
    expect(updateSettings).toHaveBeenCalledTimes(1)
    act(() => { result.current.set('openai_chat_model')('latest-edit') })
    await advance(700)
    expect(updateSettings).toHaveBeenCalledTimes(1)

    await act(async () => { first.resolve() })
    expect(updateSettings).toHaveBeenCalledTimes(2)
    expect(updateSettings.mock.calls[1][0].openai_chat_model).toBe('latest-edit')
    expect(result.current.saveState).toBe('saving')
    await advance(3000)
    expect(result.current.saveState).toBe('saving')
    await act(async () => { second.resolve() })
    expect(result.current.saveState).toBe('saved')
  })

  it('keeps a failed save visible and retries the current form', async () => {
    updateSettings.mockRejectedValueOnce(new Error('写入失败'))
    const { result } = await renderController()
    act(() => { result.current.set('openai_chat_model')('unsaved-edit') })
    await advance(700)

    expect(result.current.saveState).toBe('error')
    await advance(5000)
    expect(result.current.saveState).toBe('error')
    await act(async () => { await result.current.handleSaveSettings() })
    expect(updateSettings).toHaveBeenCalledTimes(2)
    expect(updateSettings.mock.calls[1][0].openai_chat_model).toBe('unsaved-edit')
    expect(result.current.saveState).toBe('saved')
  })

  it('does not rewrite settings already persisted by import or history restore', async () => {
    const { result } = await renderController()
    act(() => { result.current.replaceForm({ openai_chat_model: 'imported-model' }, true) })
    await advance(5000)

    expect(result.current.form.openai_chat_model).toBe('imported-model')
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it('flushes an edit when leaving settings before the debounce expires', async () => {
    const { result, unmount } = await renderController()
    act(() => { result.current.set('openai_chat_model')('before-navigation') })
    unmount()
    await act(async () => {})

    expect(updateSettings).toHaveBeenCalledTimes(1)
    expect(updateSettings.mock.calls[0][0].openai_chat_model).toBe('before-navigation')
  })

  it('retains the last edit when leaving during a pending save', async () => {
    const first = deferred()
    updateSettings.mockReturnValueOnce(first.promise)
    const { result, unmount } = await renderController()
    act(() => { result.current.set('openai_chat_model')('pending-edit') })
    await advance(700)
    act(() => { result.current.set('openai_chat_model')('last-edit') })
    unmount()
    await act(async () => { first.resolve() })

    expect(updateSettings).toHaveBeenCalledTimes(2)
    expect(updateSettings.mock.calls[1][0].openai_chat_model).toBe('last-edit')
  })

  it('reapplies an imported snapshot after an older autosave acknowledges', async () => {
    const first = deferred()
    const imported = deferred()
    updateSettings.mockReturnValueOnce(first.promise).mockReturnValueOnce(imported.promise)
    const { result } = await renderController()
    act(() => { result.current.set('openai_chat_model')('older-edit') })
    await advance(700)

    act(() => {
      result.current.replaceForm({ openai_chat_model: 'imported-model' }, true)
      result.current.markSaved()
    })
    await act(async () => { first.resolve() })

    expect(updateSettings).toHaveBeenCalledTimes(2)
    expect(updateSettings.mock.calls[1][0].openai_chat_model).toBe('imported-model')
    expect(result.current.form.openai_chat_model).toBe('imported-model')
    expect(result.current.saveState).toBe('saving')
    await act(async () => { imported.resolve() })
    expect(result.current.saveState).toBe('saved')
    await advance(5000)
    expect(updateSettings).toHaveBeenCalledTimes(2)
  })

  it('does not label a newer edit saved before its debounce reaches the queue', async () => {
    const first = deferred()
    const latest = deferred()
    updateSettings.mockReturnValueOnce(first.promise).mockReturnValueOnce(latest.promise)
    const { result } = await renderController()
    act(() => { result.current.set('openai_chat_model')('first-edit') })
    await advance(700)
    act(() => { result.current.set('openai_chat_model')('latest-edit') })
    await advance(100)
    await act(async () => { first.resolve() })

    expect(updateSettings).toHaveBeenCalledTimes(1)
    expect(result.current.saveState).not.toBe('saved')
    await advance(600)
    expect(updateSettings).toHaveBeenCalledTimes(2)
    expect(updateSettings.mock.calls[1][0].openai_chat_model).toBe('latest-edit')
    await act(async () => { latest.resolve() })
    expect(result.current.saveState).toBe('saved')
  })

  it('still applies the official snapshot when the superseded write fails', async () => {
    const first = deferred()
    updateSettings.mockReturnValueOnce(first.promise)
    const { result } = await renderController()
    act(() => { result.current.set('openai_chat_model')('older-edit') })
    await advance(700)
    act(() => { result.current.replaceForm({ openai_chat_model: 'history-model' }, true) })
    await act(async () => { first.reject(new Error('旧保存失败')) })

    expect(updateSettings).toHaveBeenCalledTimes(2)
    expect(updateSettings.mock.calls[1][0].openai_chat_model).toBe('history-model')
    expect(result.current.saveError).toBe('')
    expect(result.current.saveState).toBe('saved')
  })

  it('coalesces a later edit over a queued official snapshot', async () => {
    const first = deferred()
    updateSettings.mockReturnValueOnce(first.promise)
    const { result } = await renderController()
    act(() => { result.current.set('openai_chat_model')('older-edit') })
    await advance(700)
    act(() => { result.current.replaceForm({ openai_chat_model: 'history-model' }, true) })
    act(() => { result.current.set('openai_chat_model')('edited-history-model') })
    await advance(700)
    await act(async () => { first.resolve() })

    expect(updateSettings).toHaveBeenCalledTimes(2)
    expect(updateSettings.mock.calls[1][0].openai_chat_model).toBe('edited-history-model')
    expect(result.current.saveState).toBe('saved')
  })

  it('preserves a queued official snapshot when leaving during the older save', async () => {
    const first = deferred()
    updateSettings.mockReturnValueOnce(first.promise)
    const { result, unmount } = await renderController()
    act(() => { result.current.set('openai_chat_model')('older-edit') })
    await advance(700)
    act(() => { result.current.replaceForm({ openai_chat_model: 'history-model' }, true) })
    unmount()
    await act(async () => { first.resolve() })

    expect(updateSettings).toHaveBeenCalledTimes(2)
    expect(updateSettings.mock.calls[1][0].openai_chat_model).toBe('history-model')
  })

  it('waits for the previous mount to finish all queued edits before reloading', async () => {
    const first = deferred()
    const latest = deferred()
    let database = savedSettings
    getSettings.mockImplementation(async () => ({ ...database }))
    updateSettings.mockImplementation(async (form) => {
      const call = updateSettings.mock.calls.length
      if (call === 1) await first.promise
      if (call === 2) await latest.promise
      database = { ...form }
    })
    const previous = await renderController()
    act(() => { previous.result.current.set('openai_chat_model')('pending-edit') })
    await advance(700)
    act(() => { previous.result.current.set('openai_chat_model')('last-edit') })
    previous.unmount()
    const current = await renderController()

    expect(getSettings).toHaveBeenCalledTimes(1)
    expect(current.result.current.loading).toBe(true)
    await act(async () => { first.resolve() })
    expect(updateSettings).toHaveBeenCalledTimes(2)
    expect(getSettings).toHaveBeenCalledTimes(1)
    await act(async () => { latest.resolve() })
    expect(current.result.current.loading).toBe(false)
    expect(current.result.current.form.openai_chat_model).toBe('last-edit')

    act(() => { current.result.current.set('copilot_simple_temperature')('0.6') })
    await advance(700)
    expect(database.openai_chat_model).toBe('last-edit')
    expect(database.copilot_simple_temperature).toBe('0.6')
  })

  it('waits for the leave-page flush when returning before the debounce', async () => {
    const flush = deferred()
    let database = savedSettings
    getSettings.mockImplementation(async () => ({ ...database }))
    updateSettings.mockImplementation(async (form) => {
      await flush.promise
      database = { ...form }
    })
    const previous = await renderController()
    act(() => { previous.result.current.set('openai_chat_model')('before-navigation') })
    previous.unmount()
    const current = await renderController()

    expect(getSettings).toHaveBeenCalledTimes(1)
    expect(current.result.current.loading).toBe(true)
    await act(async () => { flush.resolve() })
    expect(current.result.current.form.openai_chat_model).toBe('before-navigation')
    expect(current.result.current.loading).toBe(false)
  })

  it('does not clear a failed current-settings save after exporting or updating history', async () => {
    updateSettings.mockRejectedValueOnce(new Error('当前配置写入失败'))
    const { result } = await renderController()
    act(() => { result.current.set('openai_chat_model')('not-persisted') })
    await advance(700)
    act(() => { result.current.markSaved() })

    expect(result.current.saveState).toBe('error')
    expect(result.current.saveError).toBe('当前配置写入失败')
    await act(async () => { await result.current.handleSaveSettings() })
    expect(result.current.saveState).toBe('saved')
  })

  it('does not mark the current form saved when an unrelated action completes before debounce', async () => {
    const { result } = await renderController()
    act(() => { result.current.set('openai_chat_model')('not-persisted') })
    act(() => { result.current.markSaved() })

    expect(result.current.saveState).not.toBe('saved')
    expect(updateSettings).not.toHaveBeenCalled()
    await advance(700)
    expect(result.current.saveState).toBe('saved')
  })
})
