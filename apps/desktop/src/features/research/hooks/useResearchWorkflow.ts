/**
 * 研究工作流管理 hook
 * 职责：Socket 订阅、工作流启停、执行日志、进度
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import * as backend from '../services/backend'
import type { StreamChunk } from '../services/backend'
import type { WorkflowStep, ProcessLogEntry } from '../shared'
import { createLogEntry } from '../shared'

export interface ResearchWorkflowState {
  isRunning: boolean
  overallProgress: number
  currentStage: string
  workflowSteps: WorkflowStep[]
  processLog: ProcessLogEntry[]
}

export interface ResearchWorkflowActions {
  start: (sessionId: string, resume?: boolean) => Promise<void>
  cancel: (sessionId: string) => Promise<void>
  log: (text: string, level?: ProcessLogEntry['level']) => void
}

export type UseResearchWorkflow = ResearchWorkflowState & ResearchWorkflowActions

// 用于外部设置 output 的回调类型
type OutputSetter = (output: Record<string, unknown>) => void

export function useResearchWorkflow(
  onOutput?: OutputSetter
): UseResearchWorkflow {
  const [isRunning, setIsRunning] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)
  const [currentStage, setCurrentStage] = useState('等待开始')
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([])
  const [processLog, setProcessLog] = useState<ProcessLogEntry[]>([])

  const unsubscribeRef = useRef<(() => void) | null>(null)

  // 追加日志
  const log = useCallback((text: string, level: ProcessLogEntry['level'] = 'info') => {
    setProcessLog((prev) => [createLogEntry(text, level), ...prev.slice(0, 99)])
  }, [])

  // 更新或插入工作流步骤
  const upsertStep = useCallback((step: WorkflowStep) => {
    setWorkflowSteps((prev) => {
      const exists = prev.some((s) => s.id === step.id)
      return exists ? prev.map((s) => (s.id === step.id ? step : s)) : [...prev, step]
    })
  }, [])

  // 处理 Socket chunk 事件
  const handleChunk = useCallback(
    (chunk: StreamChunk) => {
      switch (chunk.type) {
        case 'workflow_node_start': {
          const step = chunk.value as WorkflowStep
          upsertStep(step)
          log(`开始：${step.title}`)
          break
        }
        case 'workflow_node_complete': {
          const step = chunk.value as WorkflowStep
          upsertStep(step)
          log(`完成：${step.title}`, 'success')
          break
        }
        case 'workflow_node_error': {
          const step = chunk.value as WorkflowStep
          upsertStep(step)
          log(`失败：${step.title}${step.error ? ` — ${step.error}` : ''}`, 'error')
          break
        }
        case 'agent_log': {
          const entry = chunk.value as { message?: string; level?: string }
          if (entry?.message) log(entry.message, (entry.level as ProcessLogEntry['level']) ?? 'info')
          break
        }
        case 'workflow_progress': {
          const progress = chunk.value as { overall_progress: number; current_stage: string }
          setOverallProgress(progress.overall_progress)
          setCurrentStage(progress.current_stage)
          break
        }
        case 'output': {
          onOutput?.(chunk.value as Record<string, unknown>)
          break
        }
        case 'workflow_cancelled': {
          setIsRunning(false)
          setCurrentStage('已暂停')
          log('工作流已暂停', 'warning')
          break
        }
        case 'done': {
          const status = (chunk.value as { status?: string } | undefined)?.status
          setIsRunning(false)
          unsubscribeRef.current?.()
          unsubscribeRef.current = null
          if (status === 'completed') log('工作流完成，正在汇总产物…', 'success')
          break
        }
        case 'error': {
          setIsRunning(false)
          log(`后端错误：${String(chunk.value)}`, 'error')
          unsubscribeRef.current?.()
          unsubscribeRef.current = null
          break
        }
      }
    },
    [upsertStep, log, onOutput]
  )

  // 启动工作流
  const start = useCallback(
    async (sessionId: string, resume = false) => {
      if (isRunning) return

      setIsRunning(true)
      setCurrentStage(resume ? '从失败处继续…' : '初始化工作流')
      log(resume ? '断点续跑：只执行未完成的步骤' : '工作流启动')

      // 订阅 Socket 事件
      unsubscribeRef.current = backend.onChunk(handleChunk)
      backend.subscribeSession(sessionId)

      try {
        await backend.runWorkflow(sessionId, resume)
      } catch (err) {
        console.error('[research] failed to start workflow:', err)
        setIsRunning(false)
        log('启动工作流失败', 'error')
        unsubscribeRef.current?.()
        unsubscribeRef.current = null
      }
    },
    [isRunning, log, handleChunk]
  )

  // 暂停工作流
  const cancel = useCallback(
    async (sessionId: string) => {
      if (!isRunning) return
      try {
        await backend.cancelWorkflow(sessionId)
        log('正在暂停…', 'warning')
      } catch (err) {
        console.error('[research] failed to cancel workflow:', err)
        log('暂停失败，工作流仍在运行', 'error')
      }
    },
    [isRunning, log]
  )

  // 清理函数
  useEffect(() => {
    return () => {
      unsubscribeRef.current?.()
    }
  }, [])

  return {
    isRunning,
    overallProgress,
    currentStage,
    workflowSteps,
    processLog,
    start,
    cancel,
    log,
  }
}
