import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AssistantDock } from '../components/AssistantDock'

describe('AssistantDock', () => {
  it('uses the Xiaoyan character instead of a text placeholder', () => {
    render(<AssistantDock variant="window" />)

    const dock = screen.getByRole('button', { name: '桌面小妍' })
    expect(dock).toBeInTheDocument()
    expect(dock).toHaveStyle({
      width: '128px',
      height: '136px',
      background: 'transparent',
      boxShadow: 'none',
      filter: 'none',
    })
    expect(screen.getByRole('img', { name: '小妍' })).toBeInTheDocument()
    expect(screen.queryByText('妍')).not.toBeInTheDocument()
  })

  it('opens the context menu without immediately pasting files', () => {
    const onPasteFiles = vi.fn()
    const onOpenContextMenu = vi.fn()
    render(<AssistantDock variant="window" fileShelfCount={3} onPasteFiles={onPasteFiles} onOpenContextMenu={onOpenContextMenu} />)

    fireEvent.contextMenu(screen.getByRole('button', { name: '桌面小妍' }))
    expect(onOpenContextMenu).toHaveBeenCalledOnce()
    expect(onPasteFiles).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByRole('button', { name: '桌面小妍' }), { key: 'v', metaKey: true })
    expect(onPasteFiles).toHaveBeenCalledOnce()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
