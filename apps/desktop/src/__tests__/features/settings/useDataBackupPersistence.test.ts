import { act, cleanup, renderHook } from '@testing-library/react'
import { invoke } from '@tauri-apps/api/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings } from '@research-copilot/types'
import { DEFAULT_SETTINGS } from '../../../features/settings/pageConfig'
import { useSettingsController } from '../../../features/settings/useSettingsController'
import { useDataBackup } from '../../../features/settings/useDataBackup'
import { APP_LOCK_STATUS_CHANGE_EVENT } from '../../../features/appLock/shared'
import {
  hasSettingsRecovery,
  readSettingsAfterPersistence,
  waitForSettingsPersistence,
} from '../../../features/settings/persistence/writeCoordinator'

const { openBackup, readBackup } = vi.hoisted(() => ({
  openBackup: vi.fn(),
  readBackup: vi.fn(),
}))
vi.mock('@tauri-apps/api/app', () => ({ getVersion: vi.fn().mockResolvedValue('0.6.0-dev.1') }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: openBackup }))
vi.mock('@tauri-apps/plugin-fs', () => ({ readTextFile: readBackup }))

// Real controller, backup hook, client and persistence queue; only native boundaries
// are replaced. SQLite state and the in-memory native cache intentionally diverge.
const fileData = 'synthetic-encrypted-data-backup'
const password = 'synthetic-backup-password'
const originalModel = 'synthetic-initial-model'
const restoredModel = 'synthetic-restored-model'
const historyRefresh = vi.fn()

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}
const gates: Array<ReturnType<typeof deferred>> = []
function gate() {
  const pending = deferred()
  gates.push(pending)
  return pending
}

let database: AppSettings
let cache: AppSettings
let calls: string[]
let events: string[]
let restoreWrites: number
let beforeUpdate: (() => Promise<void>) | undefined
let beforeRestore: (() => Promise<void>) | undefined
let afterRestore: (() => Promise<void>) | undefined
let beforeReload: (() => Promise<void>) | undefined
let beforeWriteError: Error | undefined
let acknowledgementError: Error | undefined
let reloadError: Error | undefined

function count(command: string) {
  return calls.filter((entry) => entry === command).length
}

function useSettingsFlow({ omitBlocked = false }: { omitBlocked?: boolean } = {}) {
  const controller = useSettingsController(DEFAULT_SETTINGS)
  const backup = useDataBackup({
    onImport: controller.handleImportDataBackup,
    onImported: historyRefresh,
    blocked: omitBlocked ? false : controller.loading || Boolean(controller.loadError) || controller.replacementActive,
  })
  return { controller, backup }
}

async function renderFlow(omitBlocked = false) {
  const hook = renderHook(useSettingsFlow, { initialProps: { omitBlocked } })
  await act(async () => {})
  expect(hook.result.current.controller.loading).toBe(false)
  expect(hook.result.current.controller.loadError).toBe('')
  return hook
}

async function beginRestore(hook: Awaited<ReturnType<typeof renderFlow>>) {
  await act(async () => { await hook.result.current.backup.openImportPicker() })
  act(() => { hook.result.current.backup.setPassword(password) })
  let confirmation!: Promise<void>
  act(() => { confirmation = hook.result.current.backup.handleConfirm() })
  await act(async () => {})
  return { confirmation }
}

async function advance(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

describe('data backup restore and settings persistence integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    database = { ...DEFAULT_SETTINGS, openai_chat_model: originalModel }
    cache = { ...database }
    calls = []
    events = []
    restoreWrites = 0
    beforeUpdate = undefined
    beforeRestore = undefined
    afterRestore = undefined
    beforeReload = undefined
    beforeWriteError = undefined
    acknowledgementError = undefined
    reloadError = undefined
    openBackup.mockReset().mockResolvedValue('/synthetic/backup.rcbak')
    readBackup.mockReset().mockResolvedValue('  ' + fileData + '\n')
    historyRefresh.mockReset().mockImplementation(async () => { events.push('history:refresh') })
    vi.mocked(invoke).mockReset().mockImplementation(async (command, args) => {
      calls.push(command)
      const payload = args as Record<string, unknown> | undefined
      if (command === 'settings_get') return { ...cache }
      if (command === 'settings_update') {
        const data = { ...(payload?.data as AppSettings) }
        events.push('update:start')
        await beforeUpdate?.()
        database = { ...database, ...data }
        cache = { ...database }
        events.push('update:commit')
        return { ok: true, updated: Object.keys(data) }
      }
      if (command === 'data_backup_import') {
        if (payload?.data !== fileData || payload?.password !== password) {
          throw new Error('Unexpected synthetic backup import payload')
        }
        events.push('restore:start')
        await beforeRestore?.()
        if (beforeWriteError) throw beforeWriteError
        database = { ...DEFAULT_SETTINGS, openai_chat_model: restoredModel }
        restoreWrites += 1
        events.push('restore:commit')
        await afterRestore?.()
        if (acknowledgementError) throw acknowledgementError
        // Cache remains stale until the authoritative reload command succeeds.
        return undefined
      }
      if (command === 'settings_reload') {
        events.push('reload:start')
        await beforeReload?.()
        if (reloadError) throw reloadError
        cache = { ...database }
        events.push('reload:success')
        return { ...cache }
      }
      if (command === 'memory_add') return { id: 'synthetic-backup-memory' }
      throw new Error('Unexpected Tauri command: ' + command)
    })
  })

  afterEach(async () => {
    // The real coordinator is module scoped. Drain every controlled operation and
    // consume any unresolved recovery through its public read path, not a reset mock.
    beforeUpdate = undefined
    beforeRestore = undefined
    afterRestore = undefined
    beforeReload = undefined
    beforeWriteError = undefined
    acknowledgementError = undefined
    reloadError = undefined
    for (const pending of gates.splice(0)) pending.resolve()
    await act(async () => {
      cleanup()
      await waitForSettingsPersistence()
      await readSettingsAfterPersistence(() => Promise.resolve({ ...database }))
    })
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('restores once, accepts authoritative settings before refreshing history, and can save later edits', async () => {
    const hook = await renderFlow()
    const { confirmation } = await beginRestore(hook)
    await act(async () => { await confirmation })

    expect(restoreWrites).toBe(1)
    expect(count('data_backup_import')).toBe(1)
    expect(count('settings_reload')).toBe(1)
    expect(database.openai_chat_model).toBe(restoredModel)
    expect(cache.openai_chat_model).toBe(restoredModel)
    expect(hook.result.current.controller.form.openai_chat_model).toBe(restoredModel)
    expect(hook.result.current.controller.reloadRequired).toBe(false)
    expect(hook.result.current.controller.replacementActive).toBe(false)
    expect(hook.result.current.backup.modal).toBeNull()
    expect(hook.result.current.backup.error).toBe('')
    expect(historyRefresh).toHaveBeenCalledTimes(1)
    expect(events.indexOf('reload:success')).toBeLessThan(events.indexOf('history:refresh'))
    expect(hasSettingsRecovery()).toBe(false)

    act(() => { hook.result.current.controller.set('openai_chat_model')('synthetic-new-edit') })
    await advance(700)
    expect(database.openai_chat_model).toBe('synthetic-new-edit')
    expect(count('data_backup_import')).toBe(1)
  })

  it('queues restore after an older in-flight save and discards its pending successor', async () => {
    const oldSave = gate()
    beforeUpdate = () => oldSave.promise
    const hook = await renderFlow()
    act(() => { hook.result.current.controller.set('openai_chat_model')('synthetic-in-flight-edit') })
    await advance(700)
    expect(count('settings_update')).toBe(1)
    act(() => { hook.result.current.controller.set('openai_chat_model')('synthetic-queued-old-edit') })
    // Queue the successor behind the existing worker without waiting for that worker.
    act(() => { void hook.result.current.controller.handleSaveSettings() })
    const { confirmation } = await beginRestore(hook)

    expect(hook.result.current.controller.replacementActive).toBe(true)
    expect(count('data_backup_import')).toBe(0)
    await advance(1000)
    expect(count('settings_update')).toBe(1)
    await act(async () => { oldSave.resolve(); await confirmation })
    await advance(1000)

    expect(events.slice(0, 6)).toEqual([
      'update:start', 'update:commit', 'restore:start', 'restore:commit', 'reload:start', 'reload:success',
    ])
    expect(count('settings_update')).toBe(1)
    expect(database.openai_chat_model).toBe(restoredModel)
    expect(hook.result.current.controller.form.openai_chat_model).toBe(restoredModel)
  })

  it('reserves replacement before a previous debounce or explicit save can overwrite the backup', async () => {
    const acknowledgement = gate()
    afterRestore = () => acknowledgement.promise
    const hook = await renderFlow()
    act(() => { hook.result.current.controller.set('openai_chat_model')('synthetic-debounced-old-edit') })
    const { confirmation } = await beginRestore(hook)
    expect(hook.result.current.controller.replacementActive).toBe(true)
    await advance(1000)
    await act(async () => { await hook.result.current.controller.handleSaveSettings() })
    expect(count('settings_update')).toBe(0)

    await act(async () => { acknowledgement.resolve(); await confirmation })
    await advance(1000)
    expect(count('settings_update')).toBe(0)
    expect(database.openai_chat_model).toBe(restoredModel)
    expect(historyRefresh).toHaveBeenCalledTimes(1)
  })

  it('suppresses an unmount flush and makes a new controller wait for the queued restore', async () => {
    const acknowledgement = gate()
    afterRestore = () => acknowledgement.promise
    const previous = await renderFlow()
    act(() => { previous.result.current.controller.set('openai_chat_model')('synthetic-leaving-edit') })
    const { confirmation } = await beginRestore(previous)
    previous.unmount()
    const current = renderHook(useSettingsFlow)
    await act(async () => {})

    expect(current.result.current.controller.loading).toBe(true)
    expect(count('settings_get')).toBe(1)
    expect(count('settings_update')).toBe(0)
    await act(async () => { acknowledgement.resolve(); await confirmation })
    await act(async () => { await waitForSettingsPersistence() })
    expect(current.result.current.controller.loading).toBe(false)
    expect(current.result.current.controller.loadError).toBe('')
    expect(current.result.current.controller.form.openai_chat_model).toBe(restoredModel)
    expect(database.openai_chat_model).toBe(restoredModel)
    expect(count('settings_update')).toBe(0)
    expect(count('data_backup_import')).toBe(1)
    expect(historyRefresh).toHaveBeenCalledTimes(1)
  })

  it('keeps a failed readback locked and coalesces duplicate retries into one read without another restore', async () => {
    reloadError = new Error('Synthetic authoritative read failed')
    const hook = await renderFlow()
    const { confirmation } = await beginRestore(hook)
    await act(async () => { await confirmation })

    expect(hook.result.current.controller.reloadRequired).toBe(true)
    expect(hook.result.current.controller.replacementActive).toBe(true)
    expect(hook.result.current.backup.modal?.mode).toBe('import')
    expect(hook.result.current.backup.error).not.toBe('')
    expect(historyRefresh).not.toHaveBeenCalled()
    expect(cache.openai_chat_model).toBe(originalModel)
    const retryRead = gate()
    beforeReload = () => retryRead.promise
    reloadError = undefined
    const retry = hook.result.current.controller.handleReloadSettings
    let first!: Promise<void>
    let duplicate!: Promise<void>
    act(() => {
      first = retry()
      duplicate = retry()
    })
    await act(async () => {})
    expect(count('settings_reload')).toBe(2)
    expect(hook.result.current.controller.replacementActive).toBe(true)
    expect(historyRefresh).not.toHaveBeenCalled()

    await act(async () => { retryRead.resolve(); await Promise.all([first, duplicate]) })
    expect(hook.result.current.controller.form.openai_chat_model).toBe(restoredModel)
    expect(hook.result.current.controller.reloadRequired).toBe(false)
    expect(hook.result.current.controller.replacementActive).toBe(false)
    expect(hook.result.current.backup.modal).toBeNull()
    expect(hook.result.current.backup.error).toBe('')
    expect(historyRefresh).toHaveBeenCalledTimes(1)
    expect(count('data_backup_import')).toBe(1)
    await act(async () => { await hook.result.current.controller.handleReloadSettings() })
    expect(count('settings_reload')).toBe(2)
    expect(historyRefresh).toHaveBeenCalledTimes(1)
  })

  it('treats a rejected acknowledgement as possibly committed and recovers from SQLite rather than stale cache', async () => {
    acknowledgementError = new Error('Synthetic post-commit cache refresh failure')
    const hook = await renderFlow()
    act(() => { hook.result.current.controller.set('openai_chat_model')('synthetic-stale-pending-edit') })
    const { confirmation } = await beginRestore(hook)
    await act(async () => { await confirmation })
    await advance(1000)

    expect(restoreWrites).toBe(1)
    expect(database.openai_chat_model).toBe(restoredModel)
    expect(cache.openai_chat_model).toBe(originalModel)
    expect(hook.result.current.controller.reloadRequired).toBe(true)
    expect(hook.result.current.controller.replacementActive).toBe(true)
    expect(count('settings_update')).toBe(0)
    expect(count('settings_reload')).toBe(0)
    await act(async () => { await hook.result.current.controller.handleSaveSettings() })
    expect(count('settings_update')).toBe(0)

    await act(async () => { await hook.result.current.controller.handleReloadSettings() })
    expect(hook.result.current.controller.form.openai_chat_model).toBe(restoredModel)
    expect(cache.openai_chat_model).toBe(restoredModel)
    expect(count('data_backup_import')).toBe(1)
    expect(count('settings_reload')).toBe(1)
    expect(historyRefresh).toHaveBeenCalledTimes(1)
    expect(hook.result.current.controller.replacementActive).toBe(false)
  })

  it('also protects a pre-write rejection until authoritative readback replaces the unpersisted draft', async () => {
    beforeWriteError = new Error('Synthetic decryption failure before any write')
    const hook = await renderFlow()
    act(() => { hook.result.current.controller.set('openai_chat_model')('synthetic-unpersisted-edit') })
    const { confirmation } = await beginRestore(hook)
    await act(async () => { await confirmation })
    await advance(1000)

    expect(restoreWrites).toBe(0)
    expect(hook.result.current.controller.reloadRequired).toBe(true)
    expect(hook.result.current.controller.replacementActive).toBe(true)
    expect(count('settings_update')).toBe(0)
    expect(database.openai_chat_model).toBe(originalModel)
    await act(async () => { await hook.result.current.controller.handleReloadSettings() })

    expect(hook.result.current.controller.form.openai_chat_model).toBe(originalModel)
    expect(database.openai_chat_model).toBe(originalModel)
    expect(count('data_backup_import')).toBe(1)
    expect(count('settings_reload')).toBe(1)
    expect(hook.result.current.controller.replacementActive).toBe(false)
    expect(historyRefresh).toHaveBeenCalledTimes(1)
  })

  it('retains recovery across unmount, blocks saves on failed initial reload, and retries that load on the same page', async () => {
    reloadError = new Error('Synthetic persistent reload failure')
    const previous = await renderFlow()
    act(() => { previous.result.current.controller.set('openai_chat_model')('synthetic-unmount-old-edit') })
    const { confirmation } = await beginRestore(previous)
    await act(async () => { await confirmation })
    previous.unmount()
    await act(async () => { await waitForSettingsPersistence() })
    expect(hasSettingsRecovery()).toBe(true)

    const current = renderHook(useSettingsFlow)
    await act(async () => {})
    expect(current.result.current.controller.loading).toBe(false)
    expect(current.result.current.controller.loadError).not.toBe('')
    expect(count('settings_get')).toBe(1)
    expect(count('settings_reload')).toBe(2)
    act(() => { current.result.current.controller.set('openai_chat_model')('synthetic-edit-after-load-error') })
    await advance(1000)
    await act(async () => { await current.result.current.controller.handleSaveSettings() })
    await act(async () => { await current.result.current.backup.openImportPicker() })
    expect(count('settings_update')).toBe(0)
    expect(openBackup).toHaveBeenCalledTimes(1)

    reloadError = undefined
    await act(async () => { current.result.current.controller.handleRetryLoadSettings() })
    expect(current.result.current.controller.loading).toBe(false)
    expect(current.result.current.controller.loadError).toBe('')
    expect(current.result.current.controller.form.openai_chat_model).toBe(restoredModel)
    expect(cache.openai_chat_model).toBe(restoredModel)
    expect(hasSettingsRecovery()).toBe(false)
    expect(count('data_backup_import')).toBe(1)
    expect(count('settings_reload')).toBe(3)
    expect(historyRefresh).toHaveBeenCalledTimes(1)
    expect(count('settings_update')).toBe(0)
  })

  it('does not relabel a recovered backup as failed when the history refresh callback rejects', async () => {
    historyRefresh.mockRejectedValueOnce(new Error('Synthetic history refresh failure'))
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const hook = await renderFlow()
    const { confirmation } = await beginRestore(hook)
    await act(async () => { await confirmation })

    expect(hook.result.current.controller.form.openai_chat_model).toBe(restoredModel)
    expect(hook.result.current.controller.reloadRequired).toBe(false)
    expect(hook.result.current.controller.replacementActive).toBe(false)
    expect(hook.result.current.backup.error).toBe('')
    expect(hook.result.current.backup.modal).toBeNull()
    expect(historyRefresh).toHaveBeenCalledTimes(1)
    expect(warning).toHaveBeenCalled()
    await act(async () => { await hook.result.current.controller.handleReloadSettings() })
    expect(count('data_backup_import')).toBe(1)
    expect(count('settings_reload')).toBe(1)
    expect(historyRefresh).toHaveBeenCalledTimes(1)
  })


  it('preserves the recovery error and retry state when markSaved is called after a rejected backup', async () => {
    acknowledgementError = new Error('Synthetic rejected backup acknowledgement')
    const hook = await renderFlow()
    const { confirmation } = await beginRestore(hook)
    await act(async () => { await confirmation })
    const recoveryError = hook.result.current.controller.saveError
    expect(recoveryError).not.toBe('')
    expect(hook.result.current.controller.saveState).toBe('error')

    act(() => { hook.result.current.controller.markSaved() })
    await advance(3000)
    expect(hook.result.current.controller.saveState).toBe('error')
    expect(hook.result.current.controller.saveError).toBe(recoveryError)
    expect(hook.result.current.controller.reloadRequired).toBe(true)
    expect(hook.result.current.controller.replacementActive).toBe(true)
    expect(count('settings_reload')).toBe(0)
    expect(count('settings_update')).toBe(0)

    await act(async () => { await hook.result.current.controller.handleReloadSettings() })
    expect(hook.result.current.controller.reloadRequired).toBe(false)
    expect(hook.result.current.controller.form.openai_chat_model).toBe(restoredModel)
    expect(count('data_backup_import')).toBe(1)
    expect(count('settings_reload')).toBe(1)
  })

  it('closes the original modal and refreshes history even when the app-lock notification throws', async () => {
    const notificationError = new Error('Synthetic app-lock event dispatch failure')
    const dispatch = window.dispatchEvent.bind(window)
    const notification = vi.spyOn(window, 'dispatchEvent').mockImplementation((event) => {
      if (event.type === APP_LOCK_STATUS_CHANGE_EVENT) throw notificationError
      return dispatch(event)
    })
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const hook = await renderFlow()
    const { confirmation } = await beginRestore(hook)
    await act(async () => { await confirmation })

    expect(notification.mock.calls.some(([event]) => event.type === APP_LOCK_STATUS_CHANGE_EVENT)).toBe(true)
    expect(warning).toHaveBeenCalled()
    expect(hook.result.current.controller.form.openai_chat_model).toBe(restoredModel)
    expect(hook.result.current.controller.reloadRequired).toBe(false)
    expect(hook.result.current.controller.replacementActive).toBe(false)
    expect(hook.result.current.backup.modal).toBeNull()
    expect(hook.result.current.backup.error).toBe('')
    expect(historyRefresh).toHaveBeenCalledTimes(1)
    await act(async () => { await hook.result.current.controller.handleReloadSettings() })
    expect(count('data_backup_import')).toBe(1)
    expect(count('settings_reload')).toBe(1)
    expect(historyRefresh).toHaveBeenCalledTimes(1)
  })

  it('blocks new backup operations during recovery while allowing the failed modal to close', async () => {
    reloadError = new Error('Synthetic unresolved readback')
    const hook = await renderFlow()
    const { confirmation } = await beginRestore(hook)
    await act(async () => { await confirmation })
    act(() => { hook.result.current.backup.openExportModal() })
    await act(async () => {
      await hook.result.current.backup.openImportPicker()
      await hook.result.current.backup.handleConfirm()
    })
    expect(hook.result.current.backup.modal?.mode).toBe('import')
    expect(count('data_backup_import')).toBe(1)
    expect(openBackup).toHaveBeenCalledTimes(1)

    act(() => { hook.result.current.backup.closeModal() })
    act(() => { hook.result.current.backup.openExportModal() })
    expect(hook.result.current.backup.modal).toBeNull()
    expect(hook.result.current.controller.replacementActive).toBe(true)
    reloadError = undefined
    await act(async () => { await hook.result.current.controller.handleReloadSettings() })
    act(() => { hook.result.current.backup.openExportModal() })
    expect(hook.result.current.backup.modal?.mode).toBe('export')
  })

  it('keeps a newer export modal when a delayed readback callback belongs to the closed import modal', async () => {
    // The settings page blocks new modals while recovery is pending. This separate
    // embedding omits blocked to exercise the real hook callback's version boundary.
    reloadError = new Error('Synthetic first readback failure')
    const hook = await renderFlow(true)
    const { confirmation } = await beginRestore(hook)
    await act(async () => { await confirmation })
    act(() => { hook.result.current.backup.closeModal() })
    act(() => { hook.result.current.backup.openExportModal() })
    act(() => {
      hook.result.current.backup.setPassword('synthetic-new-export-password')
      hook.result.current.backup.setConfirm('synthetic-new-export-password')
    })

    reloadError = undefined
    await act(async () => { await hook.result.current.controller.handleReloadSettings() })
    expect(hook.result.current.backup.modal?.mode).toBe('export')
    expect(hook.result.current.backup.password).toBe('synthetic-new-export-password')
    expect(hook.result.current.backup.confirm).toBe('synthetic-new-export-password')
    expect(hook.result.current.backup.error).toBe('')
    expect(historyRefresh).toHaveBeenCalledTimes(1)
    expect(count('data_backup_import')).toBe(1)
    expect(count('data_backup_export')).toBe(0)
    expect(hook.result.current.controller.replacementActive).toBe(false)
  })
})
