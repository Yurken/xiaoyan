/** 设置页卸载后写入仍可继续，新挂载必须等同一窗口中所有已排队任务落库再读取。 */
let queue: Promise<void> = Promise.resolve()

export function enqueueSettingsPersistence(task: () => Promise<void>): Promise<void> {
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
