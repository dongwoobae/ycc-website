import { describe, expect, it, vi } from 'vitest'
import { computeNextRetry } from './summarize'

vi.mock('@/lib/db', () => ({ db: {} }))

describe('computeNextRetry', () => {
  const now = new Date('2026-01-01T00:00:00Z')

  it('backs off exponentially by attempt', () => {
    expect(computeNextRetry(1, now).toISOString()).toBe('2026-01-01T00:05:00.000Z')
    expect(computeNextRetry(2, now).toISOString()).toBe('2026-01-01T00:15:00.000Z')
    expect(computeNextRetry(3, now).toISOString()).toBe('2026-01-01T00:45:00.000Z')
  })
})
