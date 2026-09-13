/**
 * 桌面小妍角色组件
 * 常驻显示的小妍角色形象，可拖动，点击打开动作面板
 * 位置持久化到 localStorage
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { COMPANION_BOX_SIZE, CompanionVisual } from '../../companion/CompanionRenderer'
import { getCompanionDefinition } from '../../companion/petRegistry'
import { useCompanionLookDirection } from '../../companion/useCompanionLookDirection'
import { useAssistantDockLookDirection } from '../hooks/useAssistantDockLookDirection'

const POSITION_KEY = 'assistant-dock-position'
const { width: DOCK_WIDTH, height: DOCK_HEIGHT } = COMPANION_BOX_SIZE.floating
const XIAOYAN = getCompanionDefinition('xiaoyan')

interface AssistantDockProps {
  onClick?: () => void
  onDragStart?: () => void
  onDragEnd?: () => void
  onPasteFiles?: () => void
  fileDropActive?: boolean
  fileShelfBusy?: boolean
  fileShelfCount?: number
  fileShelfFeedback?: string | null
  /**
   * 渲染模式：
   * - floating：在主窗口内自由浮动（可拖动，位置持久化到 localStorage）
   * - window：作为独立 Tauri 窗口的内容，填满窗口，不处理内部拖动
   */
  variant?: 'floating' | 'window'
}

interface Position {
  x: number
  y: number
}

function loadPosition(): Position | null {
  try {
    const saved = localStorage.getItem(POSITION_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch {
    // ignore
  }
  return null
}

function savePosition(pos: Position) {
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify(pos))
  } catch {
    // ignore
  }
}

export function AssistantDock({
  onClick,
  onDragStart,
  onDragEnd,
  onPasteFiles,
  fileDropActive = false,
  fileShelfBusy = false,
  fileShelfCount = 0,
  fileShelfFeedback = null,
  variant = 'floating',
}: AssistantDockProps) {
  const isWindowMode = variant === 'window'
  const savedPos = loadPosition()
  const [position, setPosition] = useState<Position>(
    savedPos ?? {
      x: window.innerWidth - DOCK_WIDTH - 20,
      y: window.innerHeight - DOCK_HEIGHT - 20,
    }
  )
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; dockX: number; dockY: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canLook = !isDragging
    && XIAOYAN.renderer.kind === 'sprite-atlas'
    && Boolean(XIAOYAN.renderer.lookDirections)
  const windowLookDirectionIndex = useAssistantDockLookDirection(isWindowMode && canLook)
  const floatingLookDirectionIndex = useCompanionLookDirection({
    enabled: !isWindowMode && canLook,
    targetRef: containerRef,
  })
  const lookDirectionIndex = isWindowMode ? windowLookDirectionIndex : floatingLookDirectionIndex

  // 边界检查
  const clampPosition = useCallback((pos: Position): Position => {
    const maxX = window.innerWidth - DOCK_WIDTH
    const maxY = window.innerHeight - DOCK_HEIGHT
    return {
      x: Math.max(0, Math.min(pos.x, maxX)),
      y: Math.max(0, Math.min(pos.y, maxY)),
    }
  }, [])

  // 鼠标按下
  const handleMouseDown = useCallback(
    async (e: React.MouseEvent) => {
      // 右键不触发拖动
      if (e.button !== 0) return

      // 独立窗口模式交给系统拖动窗口；位置未变化时视为点击。
      if (isWindowMode) {
        e.preventDefault()
        e.stopPropagation()
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window')
          const currentWindow = getCurrentWindow()
          const before = await currentWindow.outerPosition()
          await currentWindow.startDragging()
          const after = await currentWindow.outerPosition()
          if (Math.abs(after.x - before.x) < 4 && Math.abs(after.y - before.y) < 4) {
            onClick?.()
          } else {
            // 窗口模式拖动结束后由调用方负责吸附与站位持久化。
            onDragEnd?.()
          }
        } catch {
          onClick?.()
        }
        return
      }

      e.preventDefault()
      e.stopPropagation()

      setIsDragging(true)
      onDragStart?.()

      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        dockX: position.x,
        dockY: position.y,
      }
    },
    [position, onDragStart, isWindowMode, onClick, onDragEnd]
  )

  // 鼠标移动
  useEffect(() => {
    if (!isDragging || isWindowMode) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return

      const dx = e.clientX - dragStartRef.current.mouseX
      const dy = e.clientY - dragStartRef.current.mouseY

      const newPos = clampPosition({
        x: dragStartRef.current.dockX + dx,
        y: dragStartRef.current.dockY + dy,
      })
      setPosition(newPos)
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (!dragStartRef.current) return

      const dx = Math.abs(e.clientX - dragStartRef.current.mouseX)
      const dy = Math.abs(e.clientY - dragStartRef.current.mouseY)

      // 如果移动距离小于 5px，视为点击
      if (dx < 5 && dy < 5) {
        onClick?.()
      }

      // 保存位置
      setPosition((pos) => {
        savePosition(pos)
        return pos
      })

      setIsDragging(false)
      dragStartRef.current = null
      onDragEnd?.()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isWindowMode, onClick, clampPosition, onDragEnd])

  // 窗口大小变化时调整位置
  useEffect(() => {
    if (isWindowMode) return

    const handleResize = () => {
      setPosition((pos) => clampPosition(pos))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [clampPosition, isWindowMode])

  return (
    <div
      ref={containerRef}
      className="z-50 flex items-center justify-center select-none"
      style={{
        width: DOCK_WIDTH,
        height: DOCK_HEIGHT,
        background: 'transparent',
        boxShadow: 'none',
        filter: 'none',
        cursor: isWindowMode ? 'pointer' : isDragging ? 'grabbing' : 'grab',
        position: isWindowMode ? 'static' : 'fixed',
        left: isWindowMode ? undefined : position.x,
        top: isWindowMode ? undefined : position.y,
        transform: isDragging ? 'scale(0.94)' : 'scale(1)',
        transition: isDragging ? 'none' : 'transform 160ms ease-out',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      role="button"
      aria-label="桌面小妍"
      title="拖入文件暂存 · 复制文件后右键粘贴"
      tabIndex={0}
      onContextMenu={(event) => {
        if (!onPasteFiles) return
        event.preventDefault()
        event.stopPropagation()
        onPasteFiles()
      }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v' && onPasteFiles) {
          e.preventDefault()
          onPasteFiles()
          return
        }
        if (e.key === 'Enter' || e.key === ' ') {
          // 阻止空格滚动页面，保持按钮键盘行为一致。
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      <CompanionVisual
        definition={XIAOYAN}
        actionKey="idle"
        inline={false}
        opacity={isDragging ? 0.86 : 1}
        lookDirectionIndex={lookDirectionIndex}
      />
      {fileShelfCount > 0 ? (
        <span
          className="pointer-events-none absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold text-white"
          style={{ background: 'var(--rc-accent)', boxShadow: '0 3px 10px rgba(0, 122, 255, 0.28)' }}
          aria-label={`文件中转站有 ${fileShelfCount} 项`}
        >
          {fileShelfCount > 99 ? '99+' : fileShelfCount}
        </span>
      ) : null}
      {fileDropActive || fileShelfBusy || fileShelfFeedback ? (
        <span
          className="pointer-events-none absolute bottom-1 left-1/2 max-w-[122px] -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold"
          style={{
            background: fileDropActive ? 'var(--rc-accent)' : 'var(--rc-card-bg)',
            border: '1px solid var(--rc-card-outline)',
            boxShadow: 'var(--rc-card-flat-shadow-sm)',
            color: fileDropActive ? 'white' : 'var(--rc-text)',
          }}
        >
          {fileDropActive ? '松手暂存' : fileShelfBusy ? '正在保管…' : fileShelfFeedback}
        </span>
      ) : null}
    </div>
  )
}
