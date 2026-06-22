import { describe, expect, it } from 'vitest'
import { formatTimestamp } from './format'

describe('formatTimestamp', () => {
  it('formats under an hour as M:SS', () => {
    expect(formatTimestamp(0)).toBe('0:00')
    expect(formatTimestamp(65)).toBe('1:05')
    expect(formatTimestamp(599)).toBe('9:59')
  })

  it('formats an hour or more as H:MM:SS', () => {
    expect(formatTimestamp(3600)).toBe('1:00:00')
    expect(formatTimestamp(3725)).toBe('1:02:05')
  })

  it('guards against bad input', () => {
    expect(formatTimestamp(-5)).toBe('0:00')
    expect(formatTimestamp(Number.NaN)).toBe('0:00')
  })
})
