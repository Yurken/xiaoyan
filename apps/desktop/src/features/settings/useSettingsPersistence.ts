import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppSettings } from '@research-copilot/types'
import { apiClient, formatErrorMessage } from '../../lib/client'
import { emitCompanionPreferenceChange, normalizeCompanionId } from '../companion/shared'
import { enqueueSettingsPersistence, hasSettingsRecovery, reserveSettingsRecovery } from './persistence/writeCoordinator'

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
  backupRecovery: boolean
  read: () => Promise<AppSettings>
  finishRecovery?: () => void
  onReadback?: (settings: AppSettings) => Promise<void> | void
}

interface ReplacementOptions {
  backupRecovery?: boolean
  onReadback?: (settings: AppSettings) => Promise<void> | void
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
      if (replacement.current && (replacement.current.committed || replacement.current.backupRecovery) && !replacement.current.running) return
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
    // Accept the form before releasing protection. A failed acceptance must
    // remain retryable, just like a failed database read.
    if (mounted.current) operation.accept(saved)
    markPersisted(saved)
    replacement.current = null
    operation.finishRecovery?.()
    if (mounted.current) {
      setReloadRequired(false)
      setReplacementActive(false)
      markSaved()
    }
  }, [markPersisted, markSaved])

  const readReplacement = useCallback(async (operation: SettingsReplacement) => {
    const saved = await operation.read()
    acceptReplacement(operation, saved)
    // History refresh and application events cannot undo a successful readback.
    // Clear the callback first so a later retry/remount cannot notify twice.
    const notify = operation.onReadback
    operation.onReadback = undefined
    try {
      await notify?.(saved)
    } catch (error) {
      console.warn('设置已重新读取，但刷新相关界面失败', error)
    }
    return saved
  }, [acceptReplacement])

  const reportReadbackFailure = useCallback((operation: SettingsReplacement, error: unknown) => {
    if (!mounted.current) return
    const status = operation.backupRecovery
      ? (operation.committed ? '备份已恢复，但读取最新设置失败' : '备份恢复结果尚未确认')
      : '配置已导入，但读取最新设置失败'
    setReloadRequired(true)
    setSaveError(status + '：' + formatErrorMessage(error) + '。请重新读取后继续编辑。')
    setSaveState('error')
  }, [])

  const retryReadback = useCallback(() => {
    const operation = replacement.current
    if (!operation || operation.running || (!operation.committed && !operation.backupRecovery)) return Promise.resolve()
    operation.running = true
    if (mounted.current) setSaveState('saving')
    return enqueueSettingsPersistence(async () => {
      try {
        await readReplacement(operation)
      } catch (error) {
        reportReadbackFailure(operation, error)
      } finally {
        operation.running = false
      }
    })
  }, [readReplacement, reportReadbackFailure])

  const save = useCallback((flush = false) => {
    // An import may already have committed while its readback is unknown. Saving
    // the old form here (including on unmount) would destroy that official state.
    if (replacement.current || hasSettingsRecovery()) return Promise.resolve()
    if (!current.current.enabled || (!mounted.current && !flush)) return Promise.resolve()
    const nextForm = current.current.form
    pending.current = { form: nextForm, signature: JSON.stringify(nextForm) }
    clearIdleTimer()
    if (worker.current) return worker.current

    const drain = async () => {
      let saved = false
      while (pending.current && current.current.enabled && !replacement.current && !hasSettingsRecovery()) {
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

  const replaceFrom = useCallback(<T,>(write: () => Promise<T>, accept: (settings: AppSettings) => void, options: ReplacementOptions = {}): Promise<T> => {
    if (!current.current.enabled) return Promise.reject(new Error('设置尚未加载完成，请稍后重试。'))
    if (replacement.current || hasSettingsRecovery()) return Promise.reject(new Error('请等待当前导入完成；读取失败时请先重新读取设置。'))
    const operation: SettingsReplacement = {
      running: true, committed: false, accept,
      backupRecovery: options.backupRecovery ?? false,
      read: options.backupRecovery ? () => apiClient.settings.reload() : () => apiClient.settings.get(),
      onReadback: options.onReadback,
    }
    // Synchronously reserve the scope before the queued task starts, including
    // debounce callbacks and the unmount flush that can run in the same turn.
    replacement.current = operation
    if (operation.backupRecovery) {
      operation.finishRecovery = reserveSettingsRecovery(() => readReplacement(operation))
    }
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
        await readReplacement(operation)
        return result
      } catch (error) {
        if (operation.committed || operation.backupRecovery) {
          reportReadbackFailure(operation, error)
        } else {
          replacement.current = null
          if (mounted.current) setReplacementActive(false)
          // The configuration importer rejects before its acknowledged write. Preserve edits,
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
  }, [clearIdleTimer, markSaved, readReplacement, reportReadbackFailure, save])

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
