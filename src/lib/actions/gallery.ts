'use server'

import { revalidatePath } from 'next/cache'
import { asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/dal'
import { db } from '@/lib/db'
import { galleryAlbums, galleryImages } from '@/lib/db/schema'
import { maxImageSize, processAndUploadImage } from '@/lib/gallery-image'
import { log } from '@/lib/logger'
import { deleteFromR2, keyFromUrl } from '@/lib/r2'

function textValue(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

function boolValue(formData: FormData, name: string) {
  return formData.get(name) === 'on' || formData.get(name) === 'true'
}

function parseEventDate(value: string) {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('invalid eventDate')
  return value
}

function getImageFile(formData: FormData, name: string, required: boolean) {
  const value = formData.get(name)
  if (!(value instanceof File) || value.size === 0) {
    if (required) throw new Error(`${name} is required`)
    return null
  }
  if (value.size > maxImageSize) throw new Error('image must be 8MB or less')
  return value
}

function revalidateGalleryPaths(albumId?: string) {
  revalidatePath('/')
  revalidatePath('/gallery')
  revalidatePath('/admin/gallery')
  if (albumId) {
    revalidatePath(`/gallery/${albumId}`)
    revalidatePath(`/admin/gallery/${albumId}/edit`)
  }
}

async function requireSession() {
  return requireAdmin()
}

async function logR2DeleteFailure(key: string, error: unknown, userId: string) {
  if (!key) return
  const message = error instanceof Error ? error.message : String(error)
  await log('error', 'r2_object', undefined, `failed to delete ${key}: ${message}`, userId)
}

async function deleteR2BestEffort(key: string, userId: string) {
  if (!key) return
  try {
    await deleteFromR2(key)
  } catch (error) {
    await logR2DeleteFailure(key, error, userId)
  }
}

export async function createAlbum(formData: FormData) {
  const s = await requireSession()
  const title = textValue(formData, 'title')
  if (!title) throw new Error('title is required')

  const cover = getImageFile(formData, 'cover', true)
  if (!cover) throw new Error('cover is required')
  const coverImgUrl = await processAndUploadImage(cover)
  let created: { id: string; title: string } | undefined
  try {
    const result = await db
      .insert(galleryAlbums)
      .values({
        title,
        description: textValue(formData, 'description') || null,
        eventDate: parseEventDate(textValue(formData, 'eventDate')),
        isPublished: boolValue(formData, 'isPublished'),
        coverImgUrl,
      })
      .returning({ id: galleryAlbums.id, title: galleryAlbums.title })
    created = result[0]
  } catch (e) {
    await deleteR2BestEffort(keyFromUrl(coverImgUrl), s.user.id)
    throw e
  }

  if (!created) throw new Error('failed to create album')
  await log('create', 'gallery_album', created.id, created.title, s.user.id)
  revalidateGalleryPaths(created.id)
  return created.id
}

export async function updateAlbum(id: string, formData: FormData) {
  const s = await requireSession()
  const title = textValue(formData, 'title')
  if (!title) throw new Error('title is required')

  const [current] = await db.select().from(galleryAlbums).where(eq(galleryAlbums.id, id)).limit(1)
  if (!current) throw new Error('album not found')

  const cover = getImageFile(formData, 'cover', false)
  const nextCoverUrl = cover ? await processAndUploadImage(cover) : current.coverImgUrl
  let updated: { id: string; title: string } | undefined
  try {
    const result = await db
      .update(galleryAlbums)
      .set({
        title,
        description: textValue(formData, 'description') || null,
        eventDate: parseEventDate(textValue(formData, 'eventDate')),
        isPublished: boolValue(formData, 'isPublished'),
        coverImgUrl: nextCoverUrl,
      })
      .where(eq(galleryAlbums.id, id))
      .returning({ id: galleryAlbums.id, title: galleryAlbums.title })
    updated = result[0]
  } catch (e) {
    if (cover) await deleteR2BestEffort(keyFromUrl(nextCoverUrl), s.user.id)
    throw e
  }

  if (!updated) throw new Error('album not found')
  if (cover && current.coverImgUrl) {
    await deleteR2BestEffort(keyFromUrl(current.coverImgUrl), s.user.id)
  }
  await log('update', 'gallery_album', updated.id, updated.title, s.user.id)
  revalidateGalleryPaths(updated.id)
}

export async function deleteAlbum(id: string) {
  const s = await requireSession()
  const [album] = await db.select().from(galleryAlbums).where(eq(galleryAlbums.id, id)).limit(1)
  if (!album) throw new Error('album not found')

  const images = await db.select().from(galleryImages).where(eq(galleryImages.albumId, id))
  const keys = [album.coverImgUrl, ...images.map((image) => image.imageUrl)].map(keyFromUrl).filter(Boolean)

  const [deleted] = await db
    .delete(galleryAlbums)
    .where(eq(galleryAlbums.id, id))
    .returning({ id: galleryAlbums.id, title: galleryAlbums.title })

  if (!deleted) throw new Error('album not found')
  await Promise.all(keys.map((key) => deleteR2BestEffort(key, s.user.id)))
  await log('delete', 'gallery_album', deleted.id, deleted.title, s.user.id)
  revalidateGalleryPaths(deleted.id)
}

// 파일 업로드는 /api/admin/gallery/upload(병렬)로 끝난 상태에서 DB 행만 순차로 넣는다.
export async function addImageRecord(albumId: string, imageUrl: string, caption: string, alt: string) {
  const s = await requireSession()
  // 우리 R2 gallery/ 키가 아닌 URL은 거부 — Route 응답 외의 임의 값 차단
  if (!keyFromUrl(imageUrl).startsWith('gallery/')) throw new Error('invalid image url')

  const [album] = await db.select().from(galleryAlbums).where(eq(galleryAlbums.id, albumId)).limit(1)
  if (!album) {
    await deleteR2BestEffort(keyFromUrl(imageUrl), s.user.id)
    throw new Error('album not found')
  }

  const [lastImage] = await db
    .select({ sortOrder: galleryImages.sortOrder })
    .from(galleryImages)
    .where(eq(galleryImages.albumId, albumId))
    .orderBy(desc(galleryImages.sortOrder))
    .limit(1)

  let created: { id: string } | undefined
  try {
    const result = await db
      .insert(galleryImages)
      .values({
        albumId,
        imageUrl,
        caption: caption.trim() || null,
        alt: alt.trim() || album.title,
        sortOrder: (lastImage?.sortOrder ?? -1) + 1,
      })
      .returning({ id: galleryImages.id })
    created = result[0]
  } catch (e) {
    await deleteR2BestEffort(keyFromUrl(imageUrl), s.user.id)
    throw e
  }

  if (!created) throw new Error('failed to add image')
  await log('create', 'gallery_image', created.id, album.title, s.user.id)
  revalidateGalleryPaths(albumId)
}

export async function updateImageMeta(imageId: string, caption: string, alt: string) {
  const s = await requireSession()
  const [image] = await db
    .select({ id: galleryImages.id, albumId: galleryImages.albumId })
    .from(galleryImages)
    .where(eq(galleryImages.id, imageId))
    .limit(1)
  if (!image) throw new Error('image not found')

  const [album] = await db
    .select({ title: galleryAlbums.title })
    .from(galleryAlbums)
    .where(eq(galleryAlbums.id, image.albumId))
    .limit(1)

  await db
    .update(galleryImages)
    .set({
      caption: caption.trim() || null,
      // 등록 시와 동일하게 빈 대체 텍스트는 앨범명으로 폴백
      alt: alt.trim() || album?.title || '',
    })
    .where(eq(galleryImages.id, imageId))

  await log('update', 'gallery_image', imageId, image.albumId, s.user.id)
  revalidateGalleryPaths(image.albumId)
}

export async function deleteImage(imageId: string) {
  const s = await requireSession()
  const [image] = await db.select().from(galleryImages).where(eq(galleryImages.id, imageId)).limit(1)
  if (!image) throw new Error('image not found')

  const [deleted] = await db
    .delete(galleryImages)
    .where(eq(galleryImages.id, imageId))
    .returning({ id: galleryImages.id, albumId: galleryImages.albumId })

  if (!deleted) throw new Error('image not found')
  await deleteR2BestEffort(keyFromUrl(image.imageUrl), s.user.id)
  await normalizeImageOrder(deleted.albumId)
  await log('delete', 'gallery_image', deleted.id, deleted.albumId, s.user.id)
  revalidateGalleryPaths(deleted.albumId)
}

export async function reorderImages(albumId: string, imageIds: string[]) {
  const s = await requireSession()
  const existing = await db
    .select({ id: galleryImages.id })
    .from(galleryImages)
    .where(eq(galleryImages.albumId, albumId))
    .orderBy(asc(galleryImages.sortOrder))

  const existingIds = new Set(existing.map((image) => image.id))
  const orderedIds = imageIds.filter((id) => existingIds.has(id))
  existing.forEach((image) => {
    if (!orderedIds.includes(image.id)) orderedIds.push(image.id)
  })

  await bulkUpdateImageOrder(orderedIds)
  await log('update', 'gallery_image', undefined, `reorder ${albumId}`, s.user.id)
  revalidateGalleryPaths(albumId)
}

async function normalizeImageOrder(albumId: string) {
  const images = await db
    .select({ id: galleryImages.id })
    .from(galleryImages)
    .where(eq(galleryImages.albumId, albumId))
    .orderBy(asc(galleryImages.sortOrder))
  await bulkUpdateImageOrder(images.map((image) => image.id))
}

async function bulkUpdateImageOrder(imageIds: string[]) {
  if (imageIds.length === 0) return
  const cases = sql.join(
    imageIds.map((id, index) => sql`WHEN ${id} THEN ${index}`),
    sql` `
  )
  await db
    .update(galleryImages)
    .set({ sortOrder: sql`CASE ${galleryImages.id} ${cases} ELSE ${galleryImages.sortOrder} END` })
    .where(inArray(galleryImages.id, imageIds))
}
