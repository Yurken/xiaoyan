import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import type { AppSettings } from '@research-copilot/types'
import { DEFAULT_SETTINGS } from '../../../features/settings/pageConfig'
import { useSettingsController } from '../../../features/settings/useSettingsController'
import { useSettingsCrypto } from '../../../features/settings/useSettingsCrypto'
import { waitForSettingsPersistence } from '../../../features/settings/persistence/writeCoordinator'

// Keep the hooks, API client and persistence worker real; replace only native boundaries.
vi.mock('@tauri-apps/api/app', () => ({ getVersion: vi.fn().mockResolvedValue('0.6.0-dev.1') }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn().mockResolvedValue('/synthetic/settings.rcconf') }))
vi.mock('@tauri-apps/plugin-fs', () => ({ readTextFile: vi.fn().mockResolvedValue('synthetic-encrypted-config') }))

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}
const gates: Array<ReturnType<typeof deferred>> = []
function gate() {
  const next = deferred()
  gates.push(next)
  return next
}

let database: AppSettings
let importWrites: number
let beforeImport: (() => Promise<void>) | undefined
let beforeUpdate: (() => Promise<void>) | undefined
let afterImport: (() => Promise<void>) | undefined
let beforeReadback: (() => Promise<void>) | undefined
let importError: Error | undefined
let readbackError: Error | undefined
let getCount: number

function useSettingsFlow() {
  const controller = useSettingsController(DEFAULT_SETTINGS)
  const crypto = useSettingsCrypto({
    onImport: controller.handleImportSettings,
    onSaved: () => controller.markSaved(),
  })
  return { controller, crypto }
}

async function renderFlow() {
  const hook = renderHook(useSettingsFlow)
  await act(async () => {})
  expect(hook.result.current.controller.loading).toBe(false)
  return hook
}

async function beginImport(hook: Awaited<ReturnType<typeof renderFlow>>) {
  await act(async () => { await hook.result.current.crypto.openImportPicker() })
  act(() => { hook.result.current.crypto.setPassword('synthetic-password') })
  let confirmation!: Promise<void>
  act(() => { confirmation = hook.result.current.crypto.handleConfirm() })
  await act(async () => {})
  return { confirmation }
}
async function advance(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

describe('settings import and autosave integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    database = { ...DEFAULT_SETTINGS, openai_chat_model: 'synthetic-initial-model' }
    importWrites = 0
    beforeImport = undefined
    beforeUpdate = undefined
    afterImport = undefined
    beforeReadback = undefined
    importError = undefined
    readbackError = undefined
    getCount = 0
    vi.mocked(invoke).mockReset().mockImplementation(async (command, args) => {
      const payload = args as Record<string, unknown> | undefined
      if (command === 'settings_get') {
        getCount += 1
        if (getCount > 1) {
          await beforeReadback?.()
          if (readbackError) throw readbackError
        }
        return { ...database }
      }
      if (command === 'settings_update') {
        const data = { ...(payload?.data as AppSettings) }
        await beforeUpdate?.()
        // Native writes merge into one durable store; no hook callbacks are mocked.
        database = { ...database, ...data }
        return { ok: true, updated: Object.keys(data) }
      }
      if (command === 'settings_import') {
        if (payload?.data !== 'synthetic-encrypted-config' || payload?.password !== 'synthetic-password') {
          throw new Error('Unexpected synthetic import payload')
        }
        await beforeImport?.()
        if (importError) throw importError
        importWrites += 1
        database = { ...database, openai_chat_model: 'synthetic-imported-model-B' }
        await afterImport?.()
        return ['openai_chat_model']
      }
      if (command === 'memory_add') return { id: 'synthetic-import-memory' }
      throw new Error(`Unexpected Tauri command: ${command}`)
    })
  })

  afterEach(async () => {
    // Release controlled calls even on assertion failure: the real module queue is shared.
    for (const pending of gates.splice(0)) pending.resolve()
    await act(async () => {
      cleanup()
      await waitForSettingsPersistence()
    })
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('imports a configuration and keeps the form consistent with durable settings', async () => {
    const hook = await renderFlow()
    const { confirmation } = await beginImport(hook)
    await act(async () => { await confirmation })
    await advance(1000)
    expect(database.openai_chat_model).toBe('synthetic-imported-model-B')
    expect(hook.result.current.controller.form.openai_chat_model).toBe('synthetic-imported-model-B')
    expect(hook.result.current.crypto.error).toBe('')
  })

  it('keeps the imported value when an older autosave finishes before the import readback', async () => {
    const oldWrite = gate()
    const readback = gate()
    beforeUpdate = () => oldWrite.promise
    beforeReadback = () => readback.promise
    const hook = await renderFlow()
    act(() => { hook.result.current.controller.set('openai_chat_model')('synthetic-older-model-A') })
    await advance(700)
    const { confirmation } = await beginImport(hook)
    await act(async () => { oldWrite.resolve() })
    await act(async () => { readback.resolve(); await confirmation })
    await advance(1000)
    expect(database.openai_chat_model).toBe('synthetic-imported-model-B')
    expect(hook.result.current.controller.form.openai_chat_model).toBe('synthetic-imported-model-B')
    expect(hook.result.current.controller.saveState).toBe('saved')
  })

  it('does not let a pre-import debounce overwrite the imported configuration', async () => {
    const importAcknowledgement = gate()
    afterImport = () => importAcknowledgement.promise
    const hook = await renderFlow()
    act(() => { hook.result.current.controller.set('openai_chat_model')('synthetic-pending-model-A') })
    const { confirmation } = await beginImport(hook)
    await advance(700)
    await act(async () => { importAcknowledgement.resolve(); await confirmation })
    await advance(1000)
    expect(database.openai_chat_model).toBe('synthetic-imported-model-B')
    expect(hook.result.current.controller.form.openai_chat_model).toBe('synthetic-imported-model-B')
  })

  it('preserves a committed import if its readback fails while an older edit is pending', async () => {
    readbackError = new Error('Synthetic settings readback failed')
    const hook = await renderFlow()
    act(() => { hook.result.current.controller.set('openai_chat_model')('synthetic-pending-model-A') })
    const { confirmation } = await beginImport(hook)
    await act(async () => { await confirmation })
    await advance(1000)
    expect(database.openai_chat_model).toBe('synthetic-imported-model-B')
    expect(hook.result.current.crypto.error).not.toBe('')
    expect(hook.result.current.controller.saveState).not.toBe('saved')
  })

  it('does not flush a stale pre-import form over the import when leaving settings', async () => {
    const importAcknowledgement = gate()
    afterImport = () => importAcknowledgement.promise
    const hook = await renderFlow()
    act(() => { hook.result.current.controller.set('openai_chat_model')('synthetic-leaving-model-A') })
    const { confirmation } = await beginImport(hook)
    hook.unmount()
    await act(async () => {})
    await act(async () => { importAcknowledgement.resolve(); await confirmation })
    await act(async () => { await waitForSettingsPersistence() })
    expect(database.openai_chat_model).toBe('synthetic-imported-model-B')
  })

  it('retains an ordinary pending edit when the import fails before writing', async () => {
    importError = new Error('Synthetic decryption failed')
    const hook = await renderFlow()
    act(() => { hook.result.current.controller.set('openai_chat_model')('synthetic-user-edit-A') })
    const { confirmation } = await beginImport(hook)
    await act(async () => { await confirmation })
    await advance(1000)
    expect(database.openai_chat_model).toBe('synthetic-user-edit-A')
    expect(hook.result.current.controller.form.openai_chat_model).toBe('synthetic-user-edit-A')
    expect(hook.result.current.crypto.error).not.toBe('')
  })
  it('keeps editing and saving after a completed import', async () => {
    const hook = await renderFlow()
    const { confirmation } = await beginImport(hook)
    await act(async () => { await confirmation })
    act(() => { hook.result.current.controller.set('openai_chat_model')('synthetic-post-import-edit-C') })
    await advance(700)
    expect(database.openai_chat_model).toBe('synthetic-post-import-edit-C')
    expect(hook.result.current.controller.form.openai_chat_model).toBe('synthetic-post-import-edit-C')
    expect(hook.result.current.controller.saveState).toBe('saved')
  })

  it('starts only one import for duplicate confirmation before the next render', async () => {
    const acknowledgement = gate()
    afterImport = () => acknowledgement.promise
    const hook = await renderFlow()
    await act(async () => { await hook.result.current.crypto.openImportPicker() })
    act(() => { hook.result.current.crypto.setPassword('synthetic-password') })
    let first!: Promise<void>
    let second!: Promise<void>
    act(() => {
      first = hook.result.current.crypto.handleConfirm()
      second = hook.result.current.crypto.handleConfirm()
    })
    await act(async () => { acknowledgement.resolve(); await Promise.all([first, second]) })
    expect(importWrites).toBe(1)
    expect(database.openai_chat_model).toBe('synthetic-imported-model-B')
  })

  it('keeps a newly opened modal intact when an older confirmed import finishes', async () => {
    const acknowledgement = gate()
    afterImport = () => acknowledgement.promise
    const hook = await renderFlow()
    const { confirmation } = await beginImport(hook)
    act(() => {
      hook.result.current.crypto.closeModal()
      hook.result.current.crypto.openExportModal()
    })
    await act(async () => { acknowledgement.resolve(); await confirmation })
    expect(database.openai_chat_model).toBe('synthetic-imported-model-B')
    expect(hook.result.current.crypto.modal?.mode).toBe('export')
    expect(hook.result.current.crypto.error).toBe('')
  })

  it('does not display an old import failure in a new modal', async () => {
    const beforeWrite = gate()
    beforeImport = () => beforeWrite.promise
    importError = new Error('Synthetic old import failed')
    const hook = await renderFlow()
    const { confirmation } = await beginImport(hook)
    act(() => {
      hook.result.current.crypto.closeModal()
      hook.result.current.crypto.openExportModal()
    })
    await act(async () => { beforeWrite.resolve(); await confirmation })
    expect(hook.result.current.crypto.modal?.mode).toBe('export')
    expect(hook.result.current.crypto.error).toBe('')
  })

  it('waits for an already confirmed import before reloading on a new mount', async () => {
    const acknowledgement = gate()
    afterImport = () => acknowledgement.promise
    const previous = await renderFlow()
    act(() => { previous.result.current.controller.set('openai_chat_model')('synthetic-leaving-model-A') })
    const { confirmation } = await beginImport(previous)
    previous.unmount()
    const current = renderHook(useSettingsFlow)
    await act(async () => {})
    expect(current.result.current.controller.loading).toBe(true)
    await act(async () => { acknowledgement.resolve(); await confirmation })
    expect(current.result.current.controller.loading).toBe(false)
    expect(current.result.current.controller.form.openai_chat_model).toBe('synthetic-imported-model-B')
    expect(database.openai_chat_model).toBe('synthetic-imported-model-B')
  })

  it('recovers a committed import by reading instead of resaving the stale form', async () => {
    readbackError = new Error('Synthetic temporary readback failure')
    const hook = await renderFlow()
    act(() => { hook.result.current.controller.set('openai_chat_model')('synthetic-pending-model-A') })
    const { confirmation } = await beginImport(hook)
    await act(async () => { await confirmation })
    expect(hook.result.current.controller.reloadRequired).toBe(true)
    readbackError = undefined
    await act(async () => { await hook.result.current.controller.handleReloadSettings() })
    expect(database.openai_chat_model).toBe('synthetic-imported-model-B')
    expect(hook.result.current.controller.form.openai_chat_model).toBe('synthetic-imported-model-B')
    expect(hook.result.current.controller.reloadRequired).toBe(false)
    expect(hook.result.current.controller.saveState).toBe('saved')
    act(() => { hook.result.current.controller.set('openai_chat_model')('synthetic-recovered-edit-C') })
    await advance(700)
    expect(database.openai_chat_model).toBe('synthetic-recovered-edit-C')
  })

  it('keeps a committed import safe after a failed retry and an unmount', async () => {
    readbackError = new Error('Synthetic persistent readback failure')
    const hook = await renderFlow()
    act(() => { hook.result.current.controller.set('openai_chat_model')('synthetic-pending-model-A') })
    const { confirmation } = await beginImport(hook)
    await act(async () => { await confirmation })
    await act(async () => { await hook.result.current.controller.handleReloadSettings() })
    hook.unmount()
    await act(async () => { await waitForSettingsPersistence() })
    expect(database.openai_chat_model).toBe('synthetic-imported-model-B')
  })

  it('completes the import even if the older in-flight autosave rejects', async () => {
    const oldWrite = gate()
    beforeUpdate = async () => { await oldWrite.promise; throw new Error('Synthetic old save failure') }
    const hook = await renderFlow()
    act(() => { hook.result.current.controller.set('openai_chat_model')('synthetic-older-model-A') })
    await advance(700)
    const { confirmation } = await beginImport(hook)
    await act(async () => { oldWrite.resolve(); await confirmation })
    expect(database.openai_chat_model).toBe('synthetic-imported-model-B')
    expect(hook.result.current.controller.form.openai_chat_model).toBe('synthetic-imported-model-B')
    expect(hook.result.current.controller.saveState).toBe('saved')
  })

  it('does not remain saving when a failed import had no unpersisted edit', async () => {
    importError = new Error('Synthetic rejected import')
    const hook = await renderFlow()
    const { confirmation } = await beginImport(hook)
    await act(async () => { await confirmation })
    expect(hook.result.current.crypto.busy).toBe(false)
    expect(hook.result.current.controller.saveState).not.toBe('saving')
    expect(database.openai_chat_model).toBe('synthetic-initial-model')
  })

  it('does not reload or erase a draft from an ordinary debounce during import recovery', async () => {
    readbackError = new Error('Synthetic one-time readback failure')
    const hook = await renderFlow()
    const { confirmation } = await beginImport(hook)
    await act(async () => { await confirmation })
    readbackError = undefined
    act(() => { hook.result.current.controller.set('openai_chat_model')('synthetic-new-edit-C') })
    await advance(700)
    expect(hook.result.current.controller.form.openai_chat_model).toBe('synthetic-new-edit-C')
    expect(getCount).toBe(2)
    expect(hook.result.current.controller.reloadRequired).toBe(true)
    expect(database.openai_chat_model).toBe('synthetic-imported-model-B')
  })

  it('keeps editing locked through modal closure and an explicit recovery request', async () => {
    readbackError = new Error('Synthetic temporary readback failure')
    const hook = await renderFlow()
    const { confirmation } = await beginImport(hook)
    await act(async () => { await confirmation })
    act(() => { hook.result.current.crypto.closeModal() })
    expect(hook.result.current.controller.replacementActive).toBe(true)
    const readback = gate()
    beforeReadback = () => readback.promise
    readbackError = undefined
    let recovery!: Promise<void>
    act(() => { recovery = hook.result.current.controller.handleReloadSettings() })
    await act(async () => {})
    expect(hook.result.current.controller.replacementActive).toBe(true)
    await act(async () => { readback.resolve(); await recovery })
    expect(hook.result.current.controller.replacementActive).toBe(false)
    expect(hook.result.current.controller.form.openai_chat_model).toBe('synthetic-imported-model-B')
    expect(importWrites).toBe(1)
  })

  it('unlocks editing after an import explicitly fails before writing', async () => {
    const beforeWrite = gate()
    beforeImport = () => beforeWrite.promise
    importError = new Error('Synthetic rejection before write')
    const hook = await renderFlow()
    act(() => { hook.result.current.controller.set('openai_chat_model')('synthetic-user-edit-A') })
    const { confirmation } = await beginImport(hook)
    act(() => { hook.result.current.crypto.closeModal() })
    expect(hook.result.current.controller.replacementActive).toBe(true)
    await act(async () => { beforeWrite.resolve(); await confirmation })
    await advance(700)
    expect(hook.result.current.controller.replacementActive).toBe(false)
    expect(database.openai_chat_model).toBe('synthetic-user-edit-A')
  })

})
