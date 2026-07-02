import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ThumbnailCandidate } from './types'

vi.mock('./webp', () => ({ toWebp: vi.fn().mockResolvedValue(Buffer.from('webp')) }))

const uploadToR2 = vi.fn()
const deleteFromR2 = vi.fn()
vi.mock('@/lib/r2', () => ({
  uploadToR2: (...args: unknown[]) => uploadToR2(...args),
  deleteFromR2: (...args: unknown[]) => deleteFromR2(...args),
  keyFromUrl: (url?: string) => (url?.startsWith('https://r2.example/') ? url.slice('https://r2.example/'.length) : ''),
}))

const selectLimit = vi.fn()
const returningMock = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        leftJoin: () => ({ where: () => ({ limit: selectLimit }) }),
        where: () => ({ limit: selectLimit }),
      }),
    }),
    insert: () => ({
      values: () => ({ onConflictDoUpdate: () => ({ returning: returningMock }) }),
    }),
  },
}))

import { storeCandidate } from './store'

function candidate(n: number): ThumbnailCandidate {
  return { style: 'classic', url: `https://r2.example/thumbnails/candidates/s1/classic-${n}.webp`, createdAt: `2026-07-0${n}` }
}

const NEW_URL = 'https://r2.example/thumbnails/candidates/s1/classic-999.webp'
const NEW_CANDIDATE = { style: 'classic' as const, url: NEW_URL, createdAt: '' }
const PNG = Buffer.from('png')

beforeEach(() => {
  vi.clearAllMocks()
  uploadToR2.mockResolvedValue(NEW_URL)
  deleteFromR2.mockResolvedValue(undefined)
})

describe('storeCandidate', () => {
  it('설교가 없으면 에러, 업로드하지 않는다', async () => {
    selectLimit.mockResolvedValue([])
    await expect(storeCandidate('s1', 'classic', PNG)).rejects.toThrow('sermon not found')
    expect(uploadToR2).not.toHaveBeenCalled()
  })

  it('트림 결과에 남은 후보는 삭제하지 않는다', async () => {
    selectLimit
      .mockResolvedValueOnce([{ candidates: [candidate(1)] }])
      .mockResolvedValueOnce([{ appliedUrl: null }])
    returningMock.mockResolvedValue([{ candidates: [candidate(1), NEW_CANDIDATE] }])

    await storeCandidate('s1', 'classic', PNG)
    expect(deleteFromR2).not.toHaveBeenCalled()
  })

  it('트림으로 밀려난 후보는 R2에서 삭제한다', async () => {
    selectLimit
      .mockResolvedValueOnce([{ candidates: [candidate(1), candidate(2), candidate(3)] }])
      .mockResolvedValueOnce([{ appliedUrl: null }])
    returningMock.mockResolvedValue([{ candidates: [candidate(2), candidate(3), NEW_CANDIDATE] }])

    await storeCandidate('s1', 'classic', PNG)
    expect(deleteFromR2).toHaveBeenCalledTimes(1)
    expect(deleteFromR2).toHaveBeenCalledWith('thumbnails/candidates/s1/classic-1.webp')
  })

  it('삭제 직전 재조회한 적용 URL과 같은 파일은 남긴다', async () => {
    selectLimit
      .mockResolvedValueOnce([{ candidates: [candidate(1), candidate(2), candidate(3)] }])
      // 그 사이 다른 세션이 candidate(1)을 되돌리기로 적용한 상황
      .mockResolvedValueOnce([{ appliedUrl: candidate(1).url }])
    returningMock.mockResolvedValue([{ candidates: [candidate(2), candidate(3), NEW_CANDIDATE] }])

    await storeCandidate('s1', 'classic', PNG)
    expect(deleteFromR2).not.toHaveBeenCalled()
  })

  it('R2 삭제가 실패해도 저장은 성공 처리한다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    deleteFromR2.mockRejectedValue(new Error('r2 down'))
    selectLimit
      .mockResolvedValueOnce([{ candidates: [candidate(1), candidate(2), candidate(3)] }])
      .mockResolvedValueOnce([{ appliedUrl: null }])
    returningMock.mockResolvedValue([{ candidates: [candidate(2), candidate(3), NEW_CANDIDATE] }])

    const result = await storeCandidate('s1', 'classic', PNG)
    expect(result.url).toBe(NEW_URL)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
