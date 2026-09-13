import { describe, expect, it } from 'vitest'
import { clampAssistantPanelHeight } from '../hooks/useAssistantPanelAutoSize'

describe('clampAssistantPanelHeight', () => {
  it('keeps the floating panel compact while allowing larger result content', () => {
    expect(clampAssistantPanelHeight(120)).toBe(220)
    expect(clampAssistantPanelHeight(341.2)).toBe(342)
    expect(clampAssistantPanelHeight(900)).toBe(620)
  })
})
