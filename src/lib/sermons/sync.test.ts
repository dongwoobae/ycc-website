import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { select: () => ({ from: () => Promise.resolve([]) }) },
}))
vi.mock('@/lib/youtube/rapidapi-channel', () => ({ fetchChannelVideos: vi.fn() }))
vi.mock('./ingest', () => ({ insertSermon: vi.fn(async () => 'sid') }))
vi.mock('./summarize', () => ({
  fetchAndStoreTranscript: vi.fn(),
  claimSermonById: vi.fn(),
  summarizeClaimed: vi.fn(),
}))
vi.mock('@/lib/qstash', () => ({ publishJob: vi.fn(async () => undefined) }))

import { resyncAllSermons } from './sync'
import { fetchChannelVideos } from '@/lib/youtube/rapidapi-channel'
import { fetchAndStoreTranscript } from './summarize'
import { publishJob } from '@/lib/qstash'

const vid = (videoId: string, title: string) => ({
  videoId,
  title,
  publishedAt: '2026-01-01T00:00:00Z',
  thumbnailUrl: null,
  durationSeconds: 10,
})

describe('resyncAllSermons onProgress', () => {
  it('신규 영상별로 current/total 진행을 통지한다', async () => {
    vi.stubEnv('YOUTUBE_CHANNEL_ID', 'UC_test')
    // 비요약 유형('특송')만 써서 transcript/summarize 경로를 타지 않게 한다.
    vi.mocked(fetchChannelVideos).mockResolvedValue([vid('a', '특송 - 은혜'), vid('b', '특송 - 사랑')])

    const calls: Array<{ current: number; total: number }> = []
    const result = await resyncAllSermons((p) => calls.push({ current: p.current, total: p.total }))

    expect(calls).toEqual([
      { current: 1, total: 2 },
      { current: 2, total: 2 },
    ])
    expect(result.inserted).toBe(2)
  })

  it('자막 미준비(요약 유형)면 QStash fetch-transcript로 폴백 발행한다', async () => {
    vi.stubEnv('YOUTUBE_CHANNEL_ID', 'UC_test')
    vi.mocked(fetchChannelVideos).mockResolvedValue([vid('c', '주일예배 - 말씀')])
    vi.mocked(fetchAndStoreTranscript).mockRejectedValue(new Error('자막 미준비'))

    const result = await resyncAllSermons()

    expect(result.inserted).toBe(1)
    expect(result.summarized).toBe(0)
    expect(publishJob).toHaveBeenCalledWith('fetch-transcript', { sermonId: 'sid', videoId: 'c' })
  })
})
