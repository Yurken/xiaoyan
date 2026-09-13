import { describe, expect, it } from 'vitest'
import { formatAssistantShortcut } from '../shared'

describe('formatAssistantShortcut', () => {
  it('formats common macOS shortcut combinations', () => {
    expect(formatAssistantShortcut({
      altKey: true,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      code: 'Space',
    })).toBe('Alt+Space')

    expect(formatAssistantShortcut({
      altKey: false,
      ctrlKey: false,
      metaKey: true,
      shiftKey: true,
      code: 'KeyY',
    })).toBe('Command+Shift+Y')
  })

  it('rejects modifier-only and unmodified keystrokes', () => {
    expect(formatAssistantShortcut({
      altKey: true,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      code: 'AltLeft',
    })).toBeNull()

    expect(formatAssistantShortcut({
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      code: 'KeyY',
    })).toBeNull()
  })
})
