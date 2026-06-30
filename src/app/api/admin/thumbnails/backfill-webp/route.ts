import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '@/lib/dal'
import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import { keyFromUrl, uploadToR2 } from '@/lib/r2'
import { toWebp } from '@/lib/thumbnails/webp'
import { log } from '@/lib/logger'

export const maxDuration = 300

/**
 * 일회성 백필: 기존 customThumbnailUrl이 PNG(thumbnails/ R2 키)인 설교를 webp로 변환·재업로드하고
 * URL을 갱신한다. unoptimized 서빙 전환 후 기존 무거운 PNG 썸네일을 경량화한다.
 * 멱등: 이미 .webp이거나 우리 R2 키가 아니면 건너뛴다. (구 PNG 객체는 삭제하지 않음 — 후보 이력 참조 보존)
 * 로그인한 관리자 브라우저 콘솔에서 1회 호출:
 *   fetch('/api/admin/thumbnails/backfill-webp', { method: 'POST' }).then(r => r.json()).then(console.log)
 */
export async function POST() {
  const session = await requireAdmin()

  const rows = await db
    .select({ id: sermons.id, url: sermons.customThumbnailUrl })
    .from(sermons)

  let converted = 0
  let skipped = 0
  let failed = 0

  for (const row of rows) {
    const url = row.url
    if (!url || !/\.png$/i.test(url) || !keyFromUrl(url)) {
      skipped++
      continue
    }
    try {
      const res = await fetch(url)
      if (!res.ok) {
        failed++
        continue
      }
      const png = Buffer.from(await res.arrayBuffer())
      const webp = await toWebp(png)
      const newKey = keyFromUrl(url).replace(/\.png$/i, '.webp')
      const newUrl = await uploadToR2(webp, newKey, 'image/webp')
      await db.update(sermons).set({ customThumbnailUrl: newUrl }).where(eq(sermons.id, row.id))
      converted++
    } catch {
      failed++
    }
  }

  await log(
    'update',
    'sermon',
    undefined,
    `thumbnail:backfill-webp total=${rows.length} converted=${converted} skipped=${skipped} failed=${failed}`,
    session.user.id
  )

  if (converted > 0) {
    revalidatePath('/')
    revalidatePath('/sermons')
  }

  return NextResponse.json({ total: rows.length, converted, skipped, failed })
}
