import { describe, expect, it } from 'vitest'
import { clampDurationSeconds, computeDurationUpdate, summarizePageViews } from './server'

describe('computeDurationUpdate', () => {
  const now = new Date('2026-07-01T12:00:00.000Z')

  it('keeps the greatest duration for matching recent rows', () => {
    expect(
      computeDurationUpdate(
        { visitorId: 'v1', createdAt: new Date('2026-07-01T10:00:00.000Z'), durationSeconds: 120 },
        { visitorId: 'v1', seconds: 60, now },
      ),
    ).toBe(120)
    expect(
      computeDurationUpdate(
        { visitorId: 'v1', createdAt: new Date('2026-07-01T10:00:00.000Z'), durationSeconds: 120 },
        { visitorId: 'v1', seconds: 180, now },
      ),
    ).toBe(180)
  })

  it('rejects visitor mismatches and rows older than 3 hours', () => {
    expect(
      computeDurationUpdate(
        { visitorId: 'other', createdAt: new Date('2026-07-01T10:00:00.000Z'), durationSeconds: 0 },
        { visitorId: 'v1', seconds: 60, now },
      ),
    ).toBeNull()
    expect(
      computeDurationUpdate(
        { visitorId: 'v1', createdAt: new Date('2026-07-01T08:59:59.000Z'), durationSeconds: 0 },
        { visitorId: 'v1', seconds: 60, now },
      ),
    ).toBeNull()
  })

  it('clamps impossible durations to the 2 hour cap', () => {
    expect(clampDurationSeconds(10_000)).toBe(7_200)
  })
})

describe('summarizePageViews', () => {
  it('calculates visitors, PV, sessions, and average session duration', () => {
    expect(
      summarizePageViews([
        { visitorId: 'v1', sessionId: 's1', durationSeconds: 60 },
        { visitorId: 'v1', sessionId: 's1', durationSeconds: 120 },
        { visitorId: 'v2', sessionId: 's2', durationSeconds: 30 },
      ]),
    ).toEqual({
      visitors: 2,
      pageViews: 3,
      sessions: 2,
      averageSessionDurationSeconds: 105,
    })
  })
})
