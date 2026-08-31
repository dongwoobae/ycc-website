import { describe, expect, it, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({ calls: 0, failFromCall: Number.POSITIVE_INFINITY }))

vi.mock('@/lib/db', () => ({
  db: {
    insert: () => {
      const n = ++state.calls
      const settle = () =>
        n >= state.failFromCall ? Promise.reject(new Error('column does not exist')) : Promise.resolve(undefined)
      const result = {
        returning: () => settle().then(() => [{ id: 'sid' }]),
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => settle().then(res, rej),
      }
      return { values: () => ({ onConflictDoNothing: () => result }) }
    },
  },
}))
vi.mock('@/lib/logger', () => ({ log: vi.fn(async () => undefined) }))

import { insertSermon } from './ingest'
import { log } from '@/lib/logger'

const video = {
  videoId: 'vid-1',
  title: '주일예배 - 제목',
  publishedAt: '2026-01-01T00:00:00Z',
  thumbnailUrl: null,
  durationSeconds: 10,
}

beforeEach(() => {
  state.calls = 0
  state.failFromCall = Number.POSITIVE_INFINITY
  vi.mocked(log).mockClear()
})

describe('insertSermon', () => {
  it('정상 등록이면 create 로그를 남긴다', async () => {
    const id = await insertSermon(video, '주일예배')

    expect(id).toBe('sid')
    expect(log).toHaveBeenCalledWith('create', 'sermon', 'sid', '주일예배 - 제목 (주일예배)')
  })

  it('자식 행 생성이 실패하면 sermons 행만 남았음을 로그로 남기고 다시 던진다', async () => {
    // 1번째 insert(sermons)는 통과시키고 2번째(sermon_summaries)부터 실패시킨다.
    state.failFromCall = 2

    await expect(insertSermon(video, '주일예배')).rejects.toThrow('column does not exist')

    expect(log).toHaveBeenCalledWith('error', 'sermon', 'sid', expect.stringContaining('videoId=vid-1'))
    const [action, , , message] = vi.mocked(log).mock.calls[0]
    expect(action).toBe('error')
    expect(message).toContain('sermons 행만 남음')
  })

  it('sermons 행 자체가 실패하면 id 없이 로그를 남기고 다시 던진다', async () => {
    state.failFromCall = 1

    await expect(insertSermon(video, '주일예배')).rejects.toThrow('column does not exist')

    expect(log).toHaveBeenCalledWith('error', 'sermon', undefined, expect.stringContaining('videoId=vid-1'))
  })
})
