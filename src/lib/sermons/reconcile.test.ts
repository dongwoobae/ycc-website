import { describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { select: () => ({ from: () => Promise.resolve([{ id: 'existing-video' }]) }) },
}))
vi.mock('@/lib/youtube/rapidapi-channel', () => ({ fetchChannelVideos: vi.fn() }))
vi.mock('./ingest', () => ({ insertSermon: vi.fn(async () => 'sid') }))
vi.mock('@/lib/qstash', () => ({ publishJob: vi.fn(async () => undefined) }))
vi.mock('@/lib/logger', () => ({ log: vi.fn(async () => undefined) }))

import { reconcileSermons } from './reconcile'
import { fetchChannelVideos } from '@/lib/youtube/rapidapi-channel'
import { insertSermon } from './ingest'
import { publishJob } from '@/lib/qstash'

const vid = (videoId: string, title: string) => ({
  videoId,
  title,
  publishedAt: '2026-01-01T00:00:00Z',
  thumbnailUrl: null,
  durationSeconds: 10,
})

describe('reconcileSermons', () => {
  it('DB에 없는 영상만 등록하고, 요약 유형이면 fetch-transcript를 발행한다', async () => {
    vi.stubEnv('YOUTUBE_CHANNEL_ID', 'UC_test')
    vi.mocked(fetchChannelVideos).mockResolvedValue([
      vid('existing-video', '주일예배 - 이미 있음'),
      vid('missing-1', '주일예배 - 누락된 설교'),
      vid('missing-2', '특송 - 비요약 유형'),
    ])

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 3, inserted: 2 })
    expect(insertSermon).toHaveBeenCalledTimes(2)
    // 요약 유형(주일예배)만 자막 체인에 투입, 특송은 등록만
    expect(publishJob).toHaveBeenCalledTimes(1)
    expect(publishJob).toHaveBeenCalledWith('fetch-transcript', { sermonId: 'sid', videoId: 'missing-1', attempt: 0 })
  })

  it('fetch-transcript 발행이 실패해도 등록 결과는 유지된다', async () => {
    vi.stubEnv('YOUTUBE_CHANNEL_ID', 'UC_test')
    vi.mocked(fetchChannelVideos).mockResolvedValue([vid('missing-3', '수요예배 - 발행 실패 케이스')])
    vi.mocked(publishJob).mockRejectedValueOnce(new Error('qstash down'))

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 1, inserted: 1 })
  })
})
