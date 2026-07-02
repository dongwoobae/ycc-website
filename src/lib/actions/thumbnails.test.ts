import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/dal', () => ({ requireAdmin: vi.fn().mockResolvedValue({ user: { id: 'admin-1' } }) }))
vi.mock('@/lib/logger', () => ({ log: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const selectLimit = vi.fn()
const updateWhere = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
    update: () => ({ set: () => ({ where: updateWhere }) }),
  },
}))

import { applyCandidateThumbnailAction, composeAndApplyThumbnailAction } from './thumbnails'

const TEXT = { headline: '제목', scripture: '' }
const OPTS = { position: 'top-right' as const }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('composeAndApplyThumbnailAction', () => {
  it('설교가 없으면 에러', async () => {
    selectLimit.mockResolvedValue([])
    await expect(composeAndApplyThumbnailAction('s1', 'classic', TEXT, OPTS)).rejects.toThrow('sermon not found')
    expect(updateWhere).not.toHaveBeenCalled()
  })

  it('저장된 배경이 없으면 먼저 생성하라고 안내', async () => {
    selectLimit.mockResolvedValue([{ backgrounds: null }])
    await expect(composeAndApplyThumbnailAction('s1', 'classic', TEXT, OPTS)).rejects.toThrow('먼저 썸네일을 생성')
    expect(updateWhere).not.toHaveBeenCalled()
  })
})

describe('applyCandidateThumbnailAction', () => {
  const URL = 'https://r2.example/thumbnails/candidates/s1/classic-1.webp'

  it('후보 목록에 없는 URL이면 에러', async () => {
    selectLimit.mockResolvedValue([{ candidates: [{ style: 'classic', url: 'https://r2.example/other.webp', createdAt: '' }] }])
    await expect(applyCandidateThumbnailAction('s1', URL)).rejects.toThrow('찾을 수 없습니다')
    expect(updateWhere).not.toHaveBeenCalled()
  })

  it('후보 목록에 있으면 썸네일로 적용한다', async () => {
    selectLimit.mockResolvedValue([{ candidates: [{ style: 'classic', url: URL, createdAt: '' }] }])
    await applyCandidateThumbnailAction('s1', URL)
    expect(updateWhere).toHaveBeenCalledTimes(1)
  })
})
