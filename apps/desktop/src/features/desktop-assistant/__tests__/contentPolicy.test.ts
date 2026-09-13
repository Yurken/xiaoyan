import { describe, expect, it } from 'vitest'
import {
  ASSISTANT_ACTION_CHARACTER_LIMITS,
  countTextCharacters,
  limitAssistantContent,
} from '../shared'

describe('desktop assistant content policy', () => {
  it.each([
    ['interpret', 12_000],
    ['translate', 20_000],
    ['chat', 16_000],
    ['import', 50_000],
  ] as const)('limits %s text to %s Unicode characters', (action, limit) => {
    expect(ASSISTANT_ACTION_CHARACTER_LIMITS[action]).toBe(limit)
    const result = limitAssistantContent(action, '研'.repeat(limit + 1))

    expect(result.truncated).toBe(true)
    expect(result.originalCharacters).toBe(limit + 1)
    expect(countTextCharacters(result.content)).toBe(limit)
  })

  it('keeps image data URLs under the separate image policy', () => {
    const image = 'data:image/png;base64,iVBORw0KGgo='
    expect(limitAssistantContent('interpret', image)).toEqual({
      content: image,
      originalCharacters: 0,
      processedCharacters: 0,
      truncated: false,
    })
  })
})
