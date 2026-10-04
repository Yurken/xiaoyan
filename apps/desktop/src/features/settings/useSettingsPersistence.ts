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

export function useSettingsPersistence(form: AppSettings, enabled: boolean) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState('')
  const current = useRef({ form, enabled })
  current.current = { form, enabled }
  const persisted = useRef('')
  const pending = useRef<SettingsSnapshot | null>(null)
  const inFlight = useRef<SettingsSnapshot | null>(null)
  const worker = useRef<Promise<void> | null>(null)
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
      // Import/history has already written this snapshot, but the older write may
      // still overwrite it. Reapply the official snapshot last through the same queue.
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
    if (inFlight.current || pending.current) {
      setSaveState('saving')
      return
    }
    // 导出文件与保存配置历史不会持久化当前 settings，不能掩盖尚未落库的修改或错误。
    if (JSON.stringify(current.current.form) !== persisted.current) return
    setSaveError('')
    setSaveState('saved')
    idleTimer.current = window.setTimeout(() => {
      idleTimer.current = null
      if (mounted.current) setSaveState('idle')
    }, duration)
  }, [clearIdleTimer])

  const save = useCallback((flush = false) => {
    if (!current.current.enabled || (!mounted.current && !flush)) return Promise.resolve()
    const nextForm = current.current.form
    pending.current = { form: nextForm, signature: JSON.stringify(nextForm) }
    clearIdleTimer()
    if (worker.current) return worker.current

    const drain = async () => {
      let saved = false
      while (pending.current && current.current.enabled) {
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
          // A failure from a superseded write must not strand the newer snapshot.
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
      if (saved && mounted.current) {
        if (JSON.stringify(current.current.form) === persisted.current) markSaved()
        else setSaveState('idle')
      }
    }

    const task = enqueueSettingsPersistence(drain).finally(() => { worker.current = null })
    worker.current = task
    return task
  }, [clearIdleTimer, markSaved])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearIdleTimer()
      if (current.current.enabled && JSON.stringify(current.current.form) !== persisted.current) {
        void save(true)
      }
    }
  }, [clearIdleTimer, save])

  useEffect(() => {
    if (!enabled || JSON.stringify(form) === persisted.current) return
    const timer = window.setTimeout(() => { void save() }, 700)
    return () => window.clearTimeout(timer)
  }, [enabled, form, save])

  return { saveState, saveError, markPersisted, markSaved, save }
}
