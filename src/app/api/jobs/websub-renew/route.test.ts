import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/qstash', () => ({ verifyQStash: vi.fn(async () => true) }))
vi.mock('@/lib/youtube/websub', () => ({
  subscribeToChannel: vi.fn(async () => undefined),
  getWebSubCallbackUrl: () => 'https://example.test/api/youtube/websub',
}))
vi.mock('@/lib/logger', () => ({ log: vi.fn(async () => undefined) }))

import { POST } from './route'
import { subscribeToChannel } from '@/lib/youtube/websub'
import { log } from '@/lib/logger'

const req = () => new Request('https://example.test/api/jobs/websub-renew', { method: 'POST', body: '{}' })

describe('POST /api/jobs/websub-renew', () => {
  it('허브 재구독이 실패하면 warning을 남기고 200을 돌려 재시도를 끊는다', async () => {
    vi.stubEnv('YOUTUBE_CHANNEL_ID', 'UC_test')
    vi.stubEnv('WEBSUB_SECRET', 's')
    vi.mocked(subscribeToChannel).mockRejectedValueOnce(new Error('websub subscribe failed: 503 Transient error'))

    const res = await POST(req())

    expect(res.status).toBe(200)
    expect(log).toHaveBeenCalledWith(
      'warning',
      'sermon',
      undefined,
      expect.stringContaining('websub subscribe failed: 503'),
    )
  })

  it('재구독이 성공하면 200을 돌려주고 로그를 남기지 않는다', async () => {
    vi.stubEnv('YOUTUBE_CHANNEL_ID', 'UC_test')
    vi.stubEnv('WEBSUB_SECRET', 's')
    vi.mocked(log).mockClear()

    const res = await POST(req())

    expect(res.status).toBe(200)
    expect(log).not.toHaveBeenCalled()
  })
})
