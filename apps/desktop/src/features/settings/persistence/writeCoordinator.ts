import type { AppSettings } from '@research-copilot/types'

/** 设置页卸载后写入仍可继续，新挂载必须等同一窗口中所有已排队任务落库再读取。 */
let queue: Promise<void> = Promise.resolve()

export function enqueueSettingsPersistence<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task)
  // 某个调用方失败不能阻塞后续实例或加载；失败反馈由调用方负责。
  queue = result.then(() => undefined, () => undefined)
  return result
}

export async function waitForSettingsPersistence(): Promise<void> {
  for (;;) {
    const observed = queue
    await observed
    // 等待期间又有卸载补写入队时，读取也必须等它完成。
    if (observed === queue) return
  }
}

// A backup acknowledgement can fail after SQLite has committed. Keep its
// authoritative readback across page unmounts; never fall back to stale cache.
let recovery: (() => Promise<AppSettings>) | null = null
let recoveryVersion = 0

export function reserveSettingsRecovery(read: () => Promise<AppSettings>): () => void {
  recovery = read
  recoveryVersion += 1
  return () => { if (recovery === read) recovery = null }
}

export function hasSettingsRecovery(): boolean {
  return recovery !== null
}

export async function readSettingsAfterPersistence(read: () => Promise<AppSettings>): Promise<AppSettings> {
  for (;;) {
    await waitForSettingsPersistence()
    const observedVersion = recoveryVersion
    const observedRecovery = recovery
    const result = await enqueueSettingsPersistence(async () => {
      // A later restore can reserve recovery after this read was queued. Never
      // run its readback ahead of its write or publish an older cached form.
      if (observedVersion !== recoveryVersion) return null
      return { settings: await (observedRecovery ?? read)() }
    })
    if (result && observedVersion === recoveryVersion) return result.settings
  }
}
