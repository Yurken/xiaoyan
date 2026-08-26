import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
})
