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

import { applyThumbnailAction, recomposeThumbnailAction } from './thumbnails'

const TEXT = { headline: '제목', scripture: '' }
const OPTS = { position: 'top-right' as const }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('recomposeThumbnailAction', () => {
  it('설교가 없으면 에러', async () => {
    selectLimit.mockResolvedValue([])
    await expect(recomposeThumbnailAction('s1', 'classic', TEXT, OPTS)).rejects.toThrow('sermon not found')
    expect(updateWhere).not.toHaveBeenCalled()
  })

  it('저장된 배경이 없으면 먼저 생성하라고 안내', async () => {
    selectLimit.mockResolvedValue([{ backgrounds: null }])
    await expect(recomposeThumbnailAction('s1', 'classic', TEXT, OPTS)).rejects.toThrow('먼저 썸네일을 생성')
    expect(updateWhere).not.toHaveBeenCalled()
  })
})

describe('applyThumbnailAction', () => {
  it('후보에 없는 URL이면 거부한다', async () => {
    selectLimit.mockResolvedValue([{ candidates: [{ style: 'classic', url: 'good', createdAt: 'x' }] }])
    await expect(applyThumbnailAction('s1', 'evil://x')).rejects.toThrow('후보 URL만')
    expect(updateWhere).not.toHaveBeenCalled()
  })

  it('후보에 있는 URL이면 customThumbnailUrl을 업데이트한다', async () => {
    selectLimit.mockResolvedValue([{ candidates: [{ style: 'classic', url: 'good', createdAt: 'x' }] }])
    await applyThumbnailAction('s1', 'good')
    expect(updateWhere).toHaveBeenCalled()
  })
})
