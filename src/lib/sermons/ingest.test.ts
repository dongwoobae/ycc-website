import { describe, expect, it, vi } from 'vitest'
import { decideIngest } from './ingest'

vi.mock('@/lib/db', () => ({ db: {} }))

describe('decideIngest', () => {
  it('skips already ingested videos', () => {
    expect(decideIngest({ exists: true, worship: null, attempt: 0 })).toEqual({ action: 'skip' })
  })

  it('inserts when playlist classification is known', () => {
    expect(
      decideIngest({ exists: false, worship: { worshipType: '주일예배', autoSummary: true }, attempt: 0 })
    ).toEqual({ action: 'insert', worshipType: '주일예배', autoSummary: true })
  })

  it('retries unknown videos before falling back to 미분류', () => {
    expect(decideIngest({ exists: false, worship: null, attempt: 0 })).toEqual({ action: 'retry' })
    expect(decideIngest({ exists: false, worship: null, attempt: 3 })).toEqual({
      action: 'insert',
      worshipType: '미분류',
      autoSummary: false,
    })
  })
})
