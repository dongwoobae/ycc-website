'use server'

import { revalidatePath } from 'next/cache'
import { desc, eq } from 'drizzle-orm'
import { requireAdmin } from '@/lib/dal'
import { db } from '@/lib/db'
import { bulletins } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import {
  bulletinPageKey,
  bulletinPdfKey,
  deleteFromR2,
  headR2Object,
  keyFromUrl,
  presignBulletinPut,
  publicUrlForKey,
  type BulletinImageExt,
  type BulletinPageSize,
} from '@/lib/r2'
import type { BulletinNotice, BulletinPage } from '@/lib/types'

/** PDF 면 수 상한. 주보는 보통 4~6면이며, 12면을 넘으면 잘못된 파일이다. */
export const maxBulletinPages = 12

export interface BulletinFormInput {
  bulletinDate: string
  volume: string
  issue: string
  sermonTitle: string
  scripture: string
  preacher: string
  hymns: string
  responsiveReading: string
  nextWeek: string
  pdfUrl?: string
  notices: BulletinNotice[]
  pages: BulletinPage[]
}

export type BulletinUploadMime = 'image/webp' | 'image/jpeg'

export interface BulletinUploadTarget {
  pageNumber: number
  size: BulletinPageSize
  /** presigned PUT URL */
  uploadUrl: string
  /** 저장할 공개 URL */
  publicUrl: string
}

export interface BulletinUploadPlan {
  uploadId: string
  pages: BulletinUploadTarget[]
  pdf?: { uploadUrl: string; publicUrl: string; contentDisposition: string }
}

const pageSizes = ['full', 'preview', 'thumb'] as const satisfies readonly BulletinPageSize[]

function revalidateBulletinPaths(id?: string) {
  revalidatePath('/')
  revalidatePath('/bulletins')
  revalidatePath('/admin/bulletins')
  if (id) {
    revalidatePath(`/bulletins/${id}`)
    revalidatePath(`/admin/bulletins/${id}/edit`)
  }
}

async function requireSession() {
  return requireAdmin()
}

function parseBulletinDate(value: string) {
  const date = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('bulletinDate is required')
  return date
}

function extForMime(mime: BulletinUploadMime): BulletinImageExt {
  return mime === 'image/webp' ? 'webp' : 'jpg'
}

/**
 * 업로드 id를 발급하고 면 세 크기 + (선택) 원본 PDF의 presigned PUT URL을 한 번에 준다.
 *
 * 액션 1회 + 브라우저 병렬 PUT이면 갤러리처럼 별도 API Route가 필요 없다.
 * 갤러리는 서버 액션이 직렬화되어 여러 장을 동시에 못 올려서 Route를 뒀다.
 */
export async function prepareBulletinUpload(input: {
  date: string
  pageCount: number
  hasPdf: boolean
  imageMime: BulletinUploadMime
}): Promise<BulletinUploadPlan> {
  await requireSession()
  const date = parseBulletinDate(input.date)
  if (!Number.isInteger(input.pageCount) || input.pageCount < 1 || input.pageCount > maxBulletinPages) {
    throw new Error(`면 수는 1~${maxBulletinPages}장이어야 합니다.`)
  }
  if (input.imageMime !== 'image/webp' && input.imageMime !== 'image/jpeg') {
    throw new Error('unsupported image mime')
  }

  const uploadId = crypto.randomUUID()
  const ext = extForMime(input.imageMime)
  const pages: BulletinUploadTarget[] = []

  for (let pageNumber = 1; pageNumber <= input.pageCount; pageNumber += 1) {
    for (const size of pageSizes) {
      const key = bulletinPageKey(date, uploadId, pageNumber, size, ext)
      pages.push({
        pageNumber,
        size,
        uploadUrl: await presignBulletinPut(key, input.imageMime),
        publicUrl: publicUrlForKey(key),
      })
    }
  }

  if (!input.hasPdf) return { uploadId, pages }

  const pdfKey = bulletinPdfKey(date, uploadId)
  // 파일명은 ASCII로 둔다 — 한글 filename은 RFC5987 인코딩이 필요해 서명 헤더가 어긋나기 쉽다.
  const contentDisposition = `attachment; filename="bulletin-${date}.pdf"`
  return {
    uploadId,
    pages,
    pdf: {
      uploadUrl: await presignBulletinPut(pdfKey, 'application/pdf', contentDisposition),
      publicUrl: publicUrlForKey(pdfKey),
      contentDisposition,
    },
  }
}

/** 면·PDF URL에서 우리 R2의 bulletins/ 키만 뽑는다. 교체 시 정리 대상 목록이 된다. */
export function bulletinAssetKeys(pages: BulletinPage[], pdfUrl: string | undefined): string[] {
  const urls = [
    ...pages.flatMap((page) => [page.fullUrl, page.previewUrl, page.thumbUrl]),
    ...(pdfUrl ? [pdfUrl] : []),
  ]
  return urls.map(keyFromUrl).filter((key) => key.startsWith('bulletins/'))
}

/**
 * 저장 전에 업로드된 실물을 확인한다.
 *
 * presigned PUT은 Content-Length를 서명하지 않으므로 클라이언트가 보낸 값을 믿을 수 없고,
 * 애초에 클라이언트가 임의 URL을 폼에 실어 보낼 수도 있다. 우리 프리픽스인지 + HEAD로 존재하는지
 * 둘 다 확인한다.
 */
export async function assertBulletinAssets(pages: BulletinPage[], pdfUrl: string | undefined): Promise<void> {
  const urls = [
    ...pages.flatMap((page) => [page.fullUrl, page.previewUrl, page.thumbUrl]),
    ...(pdfUrl ? [pdfUrl] : []),
  ]
  for (const url of urls) {
    const key = keyFromUrl(url)
    if (!key.startsWith('bulletins/')) throw new Error('invalid bulletin asset url')
    let head: Awaited<ReturnType<typeof headR2Object>>
    try {
      head = await headR2Object(key)
    } catch {
      // 일시 장애를 "없음"으로 오판해 정상 업로드를 버리지 않는다
      throw new Error('파일 확인 중 일시 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
    }
    if (!head) throw new Error('업로드된 파일을 찾을 수 없습니다. 다시 시도해 주세요.')
  }
}

async function deleteR2BestEffort(key: string, userId: string) {
  if (!key) return
  try {
    await deleteFromR2(key)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await log('error', 'r2_object', undefined, `failed to delete ${key}: ${message}`, userId)
  }
}

function isDuplicateDateError(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = error instanceof Error ? error.message : ''
  return code === '23505' || message.includes('bulletins_date_key')
}

function toValues(input: BulletinFormInput) {
  return {
    bulletinDate: parseBulletinDate(input.bulletinDate),
    volume: input.volume.trim() || null,
    issue: input.issue.trim() || null,
    sermonTitle: input.sermonTitle.trim() || null,
    scripture: input.scripture.trim() || null,
    preacher: input.preacher.trim() || null,
    hymns: input.hymns.trim() || null,
    responsiveReading: input.responsiveReading.trim() || null,
    nextWeek: input.nextWeek.trim() || null,
    pdfUrl: input.pdfUrl?.trim() || null,
    notices: input.notices,
    pages: input.pages,
  }
}

export async function createBulletin(input: BulletinFormInput) {
  const s = await requireSession()
  await assertBulletinAssets(input.pages, input.pdfUrl)
  const values = toValues(input)

  let created: { id: string; title: string } | undefined
  try {
    const result = await db
      .insert(bulletins)
      .values({ ...values, isPublished: true, createdBy: s.user.id })
      .returning({ id: bulletins.id, title: bulletins.bulletinDate })
    created = result[0]
  } catch (error) {
    if (isDuplicateDateError(error)) {
      throw new Error('같은 날짜의 주보가 이미 있습니다. 기존 주보를 수정해 주세요.')
    }
    throw error
  }

  if (!created) throw new Error('failed to create bulletin')
  await log('create', 'bulletin', created.id, created.title, s.user.id)
  revalidateBulletinPaths(created.id)
  return created.id
}

export async function updateBulletin(id: string, input: BulletinFormInput) {
  const s = await requireSession()
  await assertBulletinAssets(input.pages, input.pdfUrl)

  const [previous] = await db
    .select({ pages: bulletins.pages, pdfUrl: bulletins.pdfUrl })
    .from(bulletins)
    .where(eq(bulletins.id, id))
    .limit(1)
  if (!previous) throw new Error('bulletin not found')

  const values = toValues(input)
  let updated: { id: string; title: string } | undefined
  try {
    const result = await db
      .update(bulletins)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(bulletins.id, id))
      .returning({ id: bulletins.id, title: bulletins.bulletinDate })
    updated = result[0]
  } catch (error) {
    if (isDuplicateDateError(error)) {
      throw new Error('같은 날짜의 주보가 이미 있습니다.')
    }
    throw error
  }
  if (!updated) throw new Error('bulletin not found')

  // DB가 새 세트를 가리킨 뒤에 옛 세트를 지운다. 순서를 뒤집으면 교체 실패 시 이미지가 사라진다.
  const nextKeys = new Set(bulletinAssetKeys(input.pages, input.pdfUrl))
  const staleKeys = bulletinAssetKeys(previous.pages ?? [], previous.pdfUrl ?? undefined).filter(
    (key) => !nextKeys.has(key)
  )
  await Promise.all(staleKeys.map((key) => deleteR2BestEffort(key, s.user.id)))

  await log('update', 'bulletin', updated.id, updated.title, s.user.id)
  revalidateBulletinPaths(updated.id)
}

export async function deleteBulletin(id: string) {
  const s = await requireSession()
  const [deleted] = await db
    .delete(bulletins)
    .where(eq(bulletins.id, id))
    .returning({
      id: bulletins.id,
      title: bulletins.bulletinDate,
      pages: bulletins.pages,
      pdfUrl: bulletins.pdfUrl,
    })
  if (!deleted) throw new Error('bulletin not found')

  const keys = bulletinAssetKeys(deleted.pages ?? [], deleted.pdfUrl ?? undefined)
  await Promise.all(keys.map((key) => deleteR2BestEffort(key, s.user.id)))

  await log('delete', 'bulletin', deleted.id, deleted.title, s.user.id)
  revalidateBulletinPaths(deleted.id)
}

export async function getBulletinForAdmin(id: string) {
  await requireAdmin()
  const [row] = await db.select().from(bulletins).where(eq(bulletins.id, id)).limit(1)
  return row
}

export async function getBulletinsForAdmin() {
  await requireAdmin()
  return db.select().from(bulletins).orderBy(desc(bulletins.bulletinDate))
}
