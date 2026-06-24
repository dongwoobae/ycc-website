import { describe, expect, it } from 'vitest'
import { chooseWorshipResolution } from './classify'

describe('chooseWorshipResolution', () => {
  it('chooses the lowest priority playlist match', () => {
    const result = chooseWorshipResolution([
      { playlistId: 'special', worshipType: '특별행사', autoSummary: false, priority: 5, contains: true },
      { playlistId: 'sunday', worshipType: '주일예배', autoSummary: true, priority: 1, contains: true },
    ])
    expect(result).toEqual({ worshipType: '주일예배', autoSummary: true })
  })

  it('returns null when no playlist contains the video', () => {
    expect(
      chooseWorshipResolution([
        { playlistId: 'sunday', worshipType: '주일예배', autoSummary: true, priority: 1, contains: false },
      ])
    ).toBeNull()
  })
})
