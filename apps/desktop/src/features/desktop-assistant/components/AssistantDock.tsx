/**
 * 悬浮球组件
 * 常驻显示的小妍图标，可拖动，点击打开动作面板
 */
interface AssistantDockProps {
  onClick?: () => void
  position?: { x: number; y: number }
}

export function AssistantDock({ onClick, position }: AssistantDockProps) {
  return (
    <div
      className="fixed z-50 flex items-center justify-center"
      style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: 'var(--rc-button-primary-bg)',
        boxShadow: 'var(--rc-button-primary-shadow)',
        cursor: 'pointer',
        left: position?.x ?? 'auto',
        right: position?.x === undefined ? 20 : 'auto',
        top: position?.y ?? '50%',
        transform: position?.y === undefined ? 'translateY(-50%)' : 'none',
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.()
        }
      }}
    >
      <span className="text-lg font-bold text-white">妍</span>
    </div>
  )
}
