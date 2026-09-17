import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { select: () => ({ from: () => Promise.resolve([{ id: 'existing-video' }]) }) },
}))
vi.mock('@/lib/youtube/data-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/youtube/data-api')>()),
  listUploadCandidates: vi.fn(),
  fetchVideoDetails: vi.fn(),
}))
vi.mock('@/lib/youtube/rapidapi-channel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/youtube/rapidapi-channel')>()),
  fetchChannelVideos: vi.fn(),
}))
vi.mock('./ingest', () => ({ insertSermon: vi.fn(async () => 'sid') }))
vi.mock('@/lib/qstash', () => ({ publishJob: vi.fn(async () => undefined) }))
vi.mock('@/lib/logger', () => ({ log: vi.fn(async () => undefined) }))

import { reconcileSermons } from './reconcile'
import { fetchVideoDetails, listUploadCandidates } from '@/lib/youtube/data-api'
import { fetchChannelVideos } from '@/lib/youtube/rapidapi-channel'
import { insertSermon } from './ingest'
import { publishJob } from '@/lib/qstash'
import { log } from '@/lib/logger'
import { revalidatePath } from 'next/cache'

const candidate = (videoId: string, title: string) => ({
  videoId,
  title,
  publishedAt: '2026-01-01T00:00:00Z',
})

const detail = (durationSeconds = 10, isLiveOrUpcoming = false) => ({ durationSeconds, isLiveOrUpcoming })

const ytVideo = (videoId: string, title: string) => ({
  ...candidate(videoId, title),
  thumbnailUrl: null,
  durationSeconds: 10,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('YOUTUBE_CHANNEL_ID', 'UC_test')
  vi.stubEnv('YOUTUBE_API_KEY', 'k')
  vi.mocked(insertSermon).mockResolvedValue('sid')
})

describe('reconcileSermons — Data API 주경로', () => {
  it('DB에 없는 영상만 등록하고, 요약 유형이면 fetch-transcript를 발행한다', async () => {
    vi.mocked(listUploadCandidates).mockResolvedValue([
      candidate('existing-video', '주일예배 - 이미 있음'),
      candidate('missing-1', '주일예배 - 누락된 설교'),
      candidate('missing-2', '특송 - 비요약 유형'),
    ])
    vi.mocked(fetchVideoDetails).mockResolvedValue(
      new Map([
        ['missing-1', detail()],
        ['missing-2', detail()],
      ]),
    )

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 3, inserted: 2 })
    expect(insertSermon).toHaveBeenCalledTimes(2)
    // 등록 출처는 'reconcile' 리터럴로 고정 — insertSermon의 create 로그가 "— 폴링" 행을 남기는 유일한 신호다
    expect(insertSermon).toHaveBeenCalledWith(
      expect.objectContaining({
        videoId: 'missing-1',
        thumbnailUrl: 'https://img.youtube.com/vi/missing-1/hqdefault.jpg',
        durationSeconds: 10,
      }),
      '주일예배',
      'reconcile',
    )
    // 요약 유형(주일예배)만 자막 체인에 투입, 특송은 등록만
    expect(publishJob).toHaveBeenCalledTimes(1)
    expect(publishJob).toHaveBeenCalledWith('fetch-transcript', { sermonId: 'sid', videoId: 'missing-1', attempt: 0 })
  })

  it('누락분이 없으면 videos.list를 호출하지 않는다', async () => {
    vi.mocked(listUploadCandidates).mockResolvedValue([candidate('existing-video', '주일예배 - 이미 있음')])

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 1, inserted: 0 })
    expect(fetchVideoDetails).not.toHaveBeenCalled()
  })

  it('진행 중 라이브·예약 공개는 등록하지 않는다', async () => {
    vi.mocked(listUploadCandidates).mockResolvedValue([candidate('live-1', '주일예배 - 방송 중')])
    vi.mocked(fetchVideoDetails).mockResolvedValue(new Map([['live-1', detail(0, true)]]))

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 1, inserted: 0 })
    expect(insertSermon).not.toHaveBeenCalled()
  })

  it('상세를 못 받은 영상은 건너뛰고 warning을 남긴다', async () => {
    vi.mocked(listUploadCandidates).mockResolvedValue([candidate('missing-1', '주일예배 - 상세 없음')])
    vi.mocked(fetchVideoDetails).mockResolvedValue(new Map())

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 1, inserted: 0 })
    expect(insertSermon).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith(
      'warning',
      'sermon',
      undefined,
      expect.stringContaining('videoId=missing-1'),
    )
  })

  it('영상 상세 조회(videos.list)가 실패하면 이번 회차를 건너뛰고 error를 남긴다', async () => {
    vi.mocked(listUploadCandidates).mockResolvedValue([candidate('missing-1', '주일예배 - 상세 조회 실패')])
    vi.mocked(fetchVideoDetails).mockRejectedValue(new Error('youtube data api videos 500'))

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 1, inserted: 0 })
    expect(insertSermon).not.toHaveBeenCalled()
    // 주경로 목록 조회는 살아 있었으므로 yt-api로 다시 폴백하지 않는다
    expect(fetchChannelVideos).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith('error', 'sermon', undefined, expect.stringContaining('상세 조회 실패'))
  })

  it('빈 목록을 "전부 삭제됨"으로 해석하지 않지만, 이상 신호로 warning을 남긴다', async () => {
    vi.mocked(listUploadCandidates).mockResolvedValue([])

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 0, inserted: 0 })
    expect(insertSermon).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith('warning', 'sermon', undefined, expect.stringContaining('업로드 목록이 비었다'))
  })

  it('revalidate가 던져도 남은 누락분을 계속 등록한다', async () => {
    vi.mocked(listUploadCandidates).mockResolvedValue([
      candidate('missing-1', '주일예배 - 첫째'),
      candidate('missing-2', '주일예배 - 둘째'),
    ])
    vi.mocked(fetchVideoDetails).mockResolvedValue(
      new Map([
        ['missing-1', detail()],
        ['missing-2', detail()],
      ]),
    )
    vi.mocked(revalidatePath).mockImplementationOnce(() => {
      throw new Error('revalidate failed')
    })

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 2, inserted: 2 })
  })

  it('한 영상의 등록이 실패해도 나머지 영상은 계속 등록한다', async () => {
    vi.mocked(listUploadCandidates).mockResolvedValue([
      candidate('missing-4', '주일예배 - 등록 실패'),
      candidate('missing-5', '수요예배 - 정상 등록'),
    ])
    vi.mocked(fetchVideoDetails).mockResolvedValue(
      new Map([
        ['missing-4', detail()],
        ['missing-5', detail()],
      ]),
    )
    vi.mocked(insertSermon).mockRejectedValueOnce(new Error('insert failed'))

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 2, inserted: 1 })
    expect(publishJob).toHaveBeenCalledWith('fetch-transcript', { sermonId: 'sid', videoId: 'missing-5', attempt: 0 })
  })

  it('fetch-transcript 발행이 실패해도 등록 결과는 유지된다', async () => {
    vi.mocked(listUploadCandidates).mockResolvedValue([candidate('missing-3', '수요예배 - 발행 실패 케이스')])
    vi.mocked(fetchVideoDetails).mockResolvedValue(new Map([['missing-3', detail()]]))
    vi.mocked(publishJob).mockRejectedValueOnce(new Error('qstash down'))

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 1, inserted: 1 })
  })
})

describe('reconcileSermons — yt-api 폴백', () => {
  it('키가 없으면 yt-api로 내려가고 warning을 남긴다', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', '')
    vi.mocked(listUploadCandidates).mockRejectedValue(new Error('YOUTUBE_API_KEY is not set'))
    vi.mocked(fetchChannelVideos).mockResolvedValue([ytVideo('missing-1', '주일예배 - 폴백 등록')])

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 1, inserted: 1 })
    expect(fetchChannelVideos).toHaveBeenCalledWith('UC_test', 1)
    expect(log).toHaveBeenCalledWith('warning', 'sermon', undefined, expect.stringContaining('폴백'))
    // toYouTubeVideo가 썸네일·길이를 다시 채운다 — ytVideo() 헬퍼가 넣은 thumbnailUrl: null이 그대로 나가지 않는다
    expect(insertSermon).toHaveBeenCalledWith(
      expect.objectContaining({
        videoId: 'missing-1',
        thumbnailUrl: 'https://img.youtube.com/vi/missing-1/hqdefault.jpg',
        durationSeconds: 10,
      }),
      '주일예배',
      'reconcile',
    )
  })

  it('폴백 목록에 방송 중 스트림이 섞여도 길이가 0으로 와 등록하지 않는다', async () => {
    vi.mocked(listUploadCandidates).mockRejectedValue(new Error('youtube data api playlistItems 500'))
    vi.mocked(fetchChannelVideos).mockResolvedValue([
      { ...candidate('live-1', '주일예배 - 방송 중'), thumbnailUrl: null, durationSeconds: 0 },
      ytVideo('missing-1', '주일예배 - 폴백 등록'),
    ])

    const result = await reconcileSermons()

    // live-1은 checked에는 잡히지만(목록에 있었으므로) 등록되지 않는다 — 다음 회차가 다시 시도한다
    expect(result).toEqual({ checked: 2, inserted: 1 })
    expect(insertSermon).toHaveBeenCalledTimes(1)
    expect(insertSermon).not.toHaveBeenCalledWith(
      expect.objectContaining({ videoId: 'live-1' }),
      expect.anything(),
      expect.anything(),
    )
  })

  it('폐기된 키로 403이 나도 폴백이 걸려 주경로가 멈추지 않는다', async () => {
    vi.mocked(listUploadCandidates).mockRejectedValue(new Error('youtube data api playlistItems 403'))
    vi.mocked(fetchChannelVideos).mockResolvedValue([ytVideo('missing-1', '주일예배 - 폴백 등록')])

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 1, inserted: 1 })
    expect(insertSermon).toHaveBeenCalledTimes(1)
  })

  it('폴백 경로는 videos.list를 쓰지 않는다 — 추가 호출 없이 목록의 길이를 그대로 쓴다', async () => {
    vi.mocked(listUploadCandidates).mockRejectedValue(new Error('youtube data api playlistItems 500'))
    vi.mocked(fetchChannelVideos).mockResolvedValue([ytVideo('missing-1', '주일예배 - 폴백 등록')])

    await reconcileSermons()

    expect(fetchVideoDetails).not.toHaveBeenCalled()
  })

  it('폴백까지 실패하면 예외를 던지지 않고 빈 결과로 끝낸다', async () => {
    vi.mocked(listUploadCandidates).mockRejectedValue(new Error('youtube data api playlistItems 500'))
    vi.mocked(fetchChannelVideos).mockRejectedValue(new Error('yt-api channel/videos 429'))

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 0, inserted: 0 })
    expect(log).toHaveBeenCalledWith('error', 'sermon', undefined, expect.stringContaining('조회 실패'))
  })
})
