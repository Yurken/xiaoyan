/**
 * 悬浮球组件
 * 常驻显示的小妍图标，可拖动，点击打开动作面板
 * 位置持久化到 localStorage
 */
import { useState, useRef, useCallback, useEffect } from 'react'

const POSITION_KEY = 'assistant-dock-position'
const DOCK_SIZE = 48

interface AssistantDockProps {
  onClick?: () => void
  onDragStart?: () => void
  onDragEnd?: () => void
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

export function AssistantDock({ onClick, onDragStart, onDragEnd }: AssistantDockProps) {
  const savedPos = loadPosition()
  const [position, setPosition] = useState<Position>(
    savedPos ?? { x: window.innerWidth - DOCK_SIZE - 20, y: window.innerHeight / 2 - DOCK_SIZE / 2 }
  )
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; dockX: number; dockY: number } | null>(null)

  // 边界检查
  const clampPosition = useCallback((pos: Position): Position => {
    const maxX = window.innerWidth - DOCK_SIZE
    const maxY = window.innerHeight - DOCK_SIZE
    return {
      x: Math.max(0, Math.min(pos.x, maxX)),
      y: Math.max(0, Math.min(pos.y, maxY)),
    }
  }, [])

  // 鼠标按下
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // 右键不触发拖动
      if (e.button !== 0) return

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
    [position, onDragStart]
  )

  // 鼠标移动
  useEffect(() => {
    if (!isDragging) return

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
  }, [isDragging, onClick, clampPosition, onDragEnd])

  // 窗口大小变化时调整位置
  useEffect(() => {
    const handleResize = () => {
      setPosition((pos) => clampPosition(pos))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [clampPosition])

  return (
    <div
      className="fixed z-50 flex items-center justify-center select-none"
      style={{
        width: DOCK_SIZE,
        height: DOCK_SIZE,
        borderRadius: '50%',
        background: isDragging
          ? 'linear-gradient(145deg, #2992FF, #0A7AFF)'
          : 'var(--rc-button-primary-bg)',
        boxShadow: isDragging
          ? '0 8px 24px rgba(10, 122, 255, 0.4)'
          : 'var(--rc-button-primary-shadow)',
        cursor: isDragging ? 'grabbing' : 'grab',
        left: position.x,
        top: position.y,
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.()
        }
      }}
    >
      <span
        className="text-lg font-bold text-white pointer-events-none"
        style={{ opacity: isDragging ? 0.9 : 1 }}
      >
        妍
      </span>
    </div>
  )
}
