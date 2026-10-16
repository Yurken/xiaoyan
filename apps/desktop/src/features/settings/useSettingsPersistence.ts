import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppSettings } from '@research-copilot/types'
import { apiClient, formatErrorMessage } from '../../lib/client'
import { emitCompanionPreferenceChange, normalizeCompanionId } from '../companion/shared'
import { enqueueSettingsPersistence } from './persistence/writeCoordinator'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface SettingsSnapshot {
  form: AppSettings
  signature: string
  force?: boolean
}

interface SettingsReplacement {
  running: boolean
  committed: boolean
  accept: (settings: AppSettings) => void
}

export function useSettingsPersistence(form: AppSettings, enabled: boolean) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState('')
  const [reloadRequired, setReloadRequired] = useState(false)
  const [replacementActive, setReplacementActive] = useState(false)
  const current = useRef({ form, enabled })
  current.current = { form, enabled }
  const persisted = useRef('')
  const pending = useRef<SettingsSnapshot | null>(null)
  const inFlight = useRef<SettingsSnapshot | null>(null)
  const worker = useRef<Promise<void> | null>(null)
  const replacement = useRef<SettingsReplacement | null>(null)
  const idleTimer = useRef<number | null>(null)
  const mounted = useRef(true)

  const clearIdleTimer = useCallback(() => {
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current)
    idleTimer.current = null
  }, [])

  const markPersisted = useCallback((saved: AppSettings) => {
    const signature = JSON.stringify(saved)
    persisted.current = signature
    current.current = { ...current.current, form: saved }
    if (inFlight.current || pending.current) {
      pending.current = { form: saved, signature, force: true }
      clearIdleTimer()
      if (mounted.current) {
        setSaveError('')
        setSaveState('saving')
      }
    }
  }, [clearIdleTimer])

  const markSaved = useCallback((duration = 2500) => {
    clearIdleTimer()
    if (replacement.current || inFlight.current || pending.current) {
      if (replacement.current?.committed && !replacement.current.running) return
      setSaveState('saving')
      return
    }
    if (JSON.stringify(current.current.form) !== persisted.current) return
    setSaveError('')
    setSaveState('saved')
    idleTimer.current = window.setTimeout(() => {
      idleTimer.current = null
      if (mounted.current) setSaveState('idle')
    }, duration)
  }, [clearIdleTimer])

  const acceptReplacement = useCallback((operation: SettingsReplacement, saved: AppSettings) => {
    markPersisted(saved)
    replacement.current = null
    if (mounted.current) {
      operation.accept(saved)
      setReloadRequired(false)
      setReplacementActive(false)
      markSaved()
    }
  }, [markPersisted, markSaved])

  const reportReadbackFailure = useCallback((error: unknown) => {
    if (!mounted.current) return
    setReloadRequired(true)
    setSaveError(`配置已导入，但读取最新设置失败：${formatErrorMessage(error)}。请重新读取后继续编辑。`)
    setSaveState('error')
  }, [])

  const retryReadback = useCallback(() => {
    const operation = replacement.current
    if (!operation || operation.running || !operation.committed) return Promise.resolve()
    operation.running = true
    if (mounted.current) setSaveState('saving')
    return enqueueSettingsPersistence(async () => {
      try {
        acceptReplacement(operation, await apiClient.settings.get())
      } catch (error) {
        reportReadbackFailure(error)
      } finally {
        operation.running = false
      }
    })
  }, [acceptReplacement, reportReadbackFailure])

  const save = useCallback((flush = false) => {
    // An import may already have committed while its readback is unknown. Saving
    // the old form here (including on unmount) would destroy that official state.
    if (replacement.current) return Promise.resolve()
    if (!current.current.enabled || (!mounted.current && !flush)) return Promise.resolve()
    const nextForm = current.current.form
    pending.current = { form: nextForm, signature: JSON.stringify(nextForm) }
    clearIdleTimer()
    if (worker.current) return worker.current

    const drain = async () => {
      let saved = false
      while (pending.current && current.current.enabled && !replacement.current) {
        const snapshot = pending.current
        pending.current = null
        if (!snapshot.force && snapshot.signature === persisted.current) continue
        if (mounted.current) {
          setSaveState('saving')
          setSaveError('')
        }
        inFlight.current = snapshot
        try {
          await apiClient.settings.update(snapshot.form)
          persisted.current = snapshot.signature
          emitCompanionPreferenceChange(normalizeCompanionId(snapshot.form.xiaoyan_companion_id))
          saved = true
        } catch (error) {
          if (replacement.current) return
          if (pending.current) continue
          if (mounted.current) {
            setSaveError(formatErrorMessage(error))
            setSaveState('error')
          }
          return
        } finally {
          inFlight.current = null
        }
      }
      if (saved && mounted.current && !replacement.current) {
        if (JSON.stringify(current.current.form) === persisted.current) markSaved()
        else setSaveState('idle')
      }
    }

    const task = enqueueSettingsPersistence(drain).finally(() => { worker.current = null })
    worker.current = task
    return task
  }, [clearIdleTimer, markSaved])

  const replaceFrom = useCallback(<T,>(write: () => Promise<T>, accept: (settings: AppSettings) => void): Promise<T> => {
    if (!current.current.enabled) return Promise.reject(new Error('设置尚未加载完成，请稍后重试。'))
    if (replacement.current) return Promise.reject(new Error('请等待当前导入完成；读取失败时请先重新读取设置。'))
    const operation: SettingsReplacement = { running: true, committed: false, accept }
    // Synchronously reserve the scope before the queued task starts, including
    // debounce callbacks and the unmount flush that can run in the same turn.
    replacement.current = operation
    pending.current = null
    clearIdleTimer()
    if (mounted.current) {
      setSaveError('')
      setSaveState('saving')
      setReplacementActive(true)
    }
    return enqueueSettingsPersistence(async () => {
      try {
        const result = await write()
        operation.committed = true
        acceptReplacement(operation, await apiClient.settings.get())
        return result
      } catch (error) {
        if (operation.committed) {
          reportReadbackFailure(error)
        } else {
          replacement.current = null
          if (mounted.current) setReplacementActive(false)
          // A rejected import has not written settings. Preserve ordinary edits,
          // even when the page was left while the native request was pending.
          if (JSON.stringify(current.current.form) === persisted.current) {
            if (mounted.current) markSaved()
          } else {
            void save(!mounted.current)
          }
        }
        throw error
      } finally {
        operation.running = false
      }
    })
  }, [acceptReplacement, clearIdleTimer, markSaved, reportReadbackFailure, save])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearIdleTimer()
      if (!replacement.current && current.current.enabled && JSON.stringify(current.current.form) !== persisted.current) {
        void save(true)
      }
    }
  }, [clearIdleTimer, save])

  useEffect(() => {
    if (!enabled || JSON.stringify(form) === persisted.current) return
    const timer = window.setTimeout(() => { void save() }, 700)
    return () => window.clearTimeout(timer)
  }, [enabled, form, save])

  return { saveState, saveError, reloadRequired, replacementActive, markPersisted, markSaved, save, retryReadback, replaceFrom }
}
