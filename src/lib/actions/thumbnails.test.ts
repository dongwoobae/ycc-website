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

import { applyThumbnailAction } from './thumbnails'

beforeEach(() => {
  vi.clearAllMocks()
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
