import { describe, expect, it } from 'vitest'
import { hashVisitor, maskIp, sessionId } from './ip'

describe('maskIp', () => {
  it('masks the final IPv4 octet', () => {
    expect(maskIp('123.45.67.89')).toBe('123.45.67.0')
  })

  it('masks the lower IPv6 groups', () => {
    expect(maskIp('2001:db8:85a3::8a2e:370:7334')).toBe('2001:db8:85a3:0:0:0:0:0')
  })

  it('returns null for invalid input', () => {
    expect(maskIp('not-an-ip')).toBeNull()
  })
})

describe('hashVisitor', () => {
  it('is deterministic for identical inputs', () => {
    const first = hashVisitor('salt', '2026-07-01', '1.2.3.4', 'ua')
    expect(hashVisitor('salt', '2026-07-01', '1.2.3.4', 'ua')).toBe(first)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
  })

  it('rotates when the KST date changes', () => {
    expect(hashVisitor('salt', '2026-07-01', '1.2.3.4', 'ua')).not.toBe(
      hashVisitor('salt', '2026-07-02', '1.2.3.4', 'ua'),
    )
  })

  it('throws a clear error when the salt is missing', () => {
    expect(() => hashVisitor('', '2026-07-01', '1.2.3.4', 'ua')).toThrow('ANALYTICS_SALT')
  })
})

describe('sessionId', () => {
  it('keeps the same id inside a 30 minute bucket', () => {
    const first = sessionId('visitor', '2026-07-01', Date.UTC(2026, 6, 1, 0, 0, 0))
    const second = sessionId('visitor', '2026-07-01', Date.UTC(2026, 6, 1, 0, 29, 59))
    expect(second).toBe(first)
  })

  it('changes across a 30 minute bucket boundary', () => {
    expect(sessionId('visitor', '2026-07-01', Date.UTC(2026, 6, 1, 0, 29, 59))).not.toBe(
      sessionId('visitor', '2026-07-01', Date.UTC(2026, 6, 1, 0, 30, 0)),
    )
  })
})
