import { describe, expect, it } from 'vitest'
import { isBot } from './bots'

describe('isBot', () => {
  it('detects common crawlers', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true)
    expect(isBot('bingbot/2.0')).toBe(true)
    expect(isBot('Some crawler spider')).toBe(true)
  })

  it('allows ordinary browser user agents', () => {
    expect(
      isBot(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
      ),
    ).toBe(false)
  })
})
