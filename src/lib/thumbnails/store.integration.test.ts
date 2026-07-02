import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { makeTestDb, insertSermonFixture, type TestDb } from '@/test/pg'
import { sermons, sermonThumbnails } from '@/lib/db/schema'

const h = vi.hoisted(() => ({ db: null as unknown as TestDb }))
vi.mock('@/lib/db', () => ({ get db() { return h.db } }))
vi.mock('./webp', () => ({ toWebp: vi.fn(async (buffer: Buffer) => buffer) }))

// candidateKey의 Date.now()는 같은 ms에 충돌할 수 있어 카운터로 고유 URL을 만든다.
const deleted: string[] = []
let uploadSeq = 0
vi.mock('@/lib/r2', () => ({
  uploadToR2: vi.fn(async () => `https://r2.example/thumbnails/candidates/mock-${++uploadSeq}.webp`),
  deleteFromR2: vi.fn(async (key: string) => {
    deleted.push(key)
  }),
  keyFromUrl: (url?: string | null) =>
    url?.startsWith('https://r2.example/') ? url.slice('https://r2.example/'.length) : '',
}))

let close: () => Promise<void>
beforeAll(async () => {
  const t = await makeTestDb()
  h.db = t.db
  close = t.close
})
afterAll(async () => {
  await close()
})
beforeEach(() => {
  deleted.length = 0
})

// 모듈은 mock 설정 이후 import (동적 import로 보장)
const { storeCandidate, storeText, MAX_THUMBNAIL_CANDIDATES } = await import('./store')

function toKey(url: string) {
  return url.slice('https://r2.example/'.length)
}

describe('storeCandidate (integration) — 원자적 append+trim SQL', () => {
  it('위성 행이 없으면 만들고, 반복 저장 시 최근 N건만 순서대로 남기며 초과분을 R2에서 지운다', async () => {
    const id = await insertSermonFixture(h.db, { withSummaryRow: false })

    const urls: string[] = []
    for (let i = 0; i < MAX_THUMBNAIL_CANDIDATES + 2; i++) {
      const c = await storeCandidate(id, 'classic', Buffer.from(`png${i}`))
      urls.push(c.url)
    }

    const [row] = await h.db.select().from(sermonThumbnails).where(eq(sermonThumbnails.sermonId, id))
    expect(row.thumbnailCandidates?.map((c) => c.url)).toEqual(urls.slice(-MAX_THUMBNAIL_CANDIDATES))
    expect(deleted).toEqual(urls.slice(0, 2).map(toKey))
  })

  it('적용 중인 썸네일은 트림으로 배열에서 밀려나도 파일은 지우지 않는다', async () => {
    const id = await insertSermonFixture(h.db, { withSummaryRow: false })
    const first = await storeCandidate(id, 'classic', Buffer.from('a'))
    await h.db.update(sermons).set({ customThumbnailUrl: first.url }).where(eq(sermons.id, id))

    for (let i = 0; i < MAX_THUMBNAIL_CANDIDATES; i++) {
      await storeCandidate(id, 'hook', Buffer.from(`b${i}`))
    }

    const [row] = await h.db.select().from(sermonThumbnails).where(eq(sermonThumbnails.sermonId, id))
    expect(row.thumbnailCandidates?.some((c) => c.url === first.url)).toBe(false) // 배열에선 밀려남
    expect(deleted).toEqual([]) // 파일은 보존
  })
})

describe('storeText (integration) — 스타일별 문구 merge upsert', () => {
  it('위성 행이 없으면 만들고, 같은 스타일은 덮어쓰되 다른 스타일은 보존한다', async () => {
    const id = await insertSermonFixture(h.db, { withSummaryRow: false })

    await storeText(id, 'classic', { headline: '제목', scripture: '요 3:16' })
    await storeText(id, 'hook', { headline: '후킹 문구', scripture: '' })
    await storeText(id, 'classic', { headline: '수정된 제목', scripture: '요 3:16' })

    const [row] = await h.db.select().from(sermonThumbnails).where(eq(sermonThumbnails.sermonId, id))
    expect(row.thumbnailTexts).toEqual({
      classic: { headline: '수정된 제목', scripture: '요 3:16' },
      hook: { headline: '후킹 문구', scripture: '' },
    })
  })
})
