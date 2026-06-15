'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { asc, desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { galleryAlbums, galleryImages } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import { deleteFromR2, galleryImageKey, keyFromUrl, uploadToR2 } from '@/lib/r2'

const maxImageSize = 8 * 1024 * 1024

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
  if (!value.type.startsWith('image/')) throw new Error('image file only')
  if (value.size > maxImageSize) throw new Error('image must be 8MB or less')
  return value
}

async function uploadImage(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer())
  return uploadToR2(buffer, galleryImageKey(file.name), file.type)
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
  const s = await auth.api.getSession({ headers: await headers() }); if (!s) throw new Error('unauthorized')
  return s
}

export async function createAlbum(formData: FormData) {
  const s = await requireSession()
  const title = textValue(formData, 'title')
  if (!title) throw new Error('title is required')

  const cover = getImageFile(formData, 'cover', true)
  if (!cover) throw new Error('cover is required')
  const coverImgUrl = await uploadImage(cover)
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
    await deleteFromR2(keyFromUrl(coverImgUrl)).catch(() => undefined)
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
  const nextCoverUrl = cover ? await uploadImage(cover) : current.coverImgUrl
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
    if (cover) await deleteFromR2(keyFromUrl(nextCoverUrl)).catch(() => undefined)
    throw e
  }

  if (!updated) throw new Error('album not found')
  if (cover && current.coverImgUrl) {
    await deleteFromR2(keyFromUrl(current.coverImgUrl)).catch(() => undefined)
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
  await Promise.allSettled(keys.map((key) => deleteFromR2(key)))

  const [deleted] = await db
    .delete(galleryAlbums)
    .where(eq(galleryAlbums.id, id))
    .returning({ id: galleryAlbums.id, title: galleryAlbums.title })

  if (!deleted) throw new Error('album not found')
  await log('delete', 'gallery_album', deleted.id, deleted.title, s.user.id)
  revalidateGalleryPaths(deleted.id)
}

export async function addImage(albumId: string, formData: FormData) {
  const s = await requireSession()
  const [album] = await db.select().from(galleryAlbums).where(eq(galleryAlbums.id, albumId)).limit(1)
  if (!album) throw new Error('album not found')

  const file = getImageFile(formData, 'image', true)
  if (!file) throw new Error('image is required')
  const imageUrl = await uploadImage(file)
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
        caption: textValue(formData, 'caption') || null,
        alt: textValue(formData, 'alt') || album.title,
        sortOrder: (lastImage?.sortOrder ?? -1) + 1,
      })
      .returning({ id: galleryImages.id })
    created = result[0]
  } catch (e) {
    await deleteFromR2(keyFromUrl(imageUrl)).catch(() => undefined)
    throw e
  }

  if (!created) throw new Error('failed to add image')
  await log('create', 'gallery_image', created.id, album.title, s.user.id)
  revalidateGalleryPaths(albumId)
}

export async function deleteImage(imageId: string) {
  const s = await requireSession()
  const [image] = await db.select().from(galleryImages).where(eq(galleryImages.id, imageId)).limit(1)
  if (!image) throw new Error('image not found')

  await deleteFromR2(keyFromUrl(image.imageUrl)).catch(() => undefined)
  const [deleted] = await db
    .delete(galleryImages)
    .where(eq(galleryImages.id, imageId))
    .returning({ id: galleryImages.id, albumId: galleryImages.albumId })

  if (!deleted) throw new Error('image not found')
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

  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(galleryImages).set({ sortOrder: index }).where(eq(galleryImages.id, id))
    )
  )
  await log('update', 'gallery_image', undefined, `reorder ${albumId}`, s.user.id)
  revalidateGalleryPaths(albumId)
}

async function normalizeImageOrder(albumId: string) {
  const images = await db
    .select({ id: galleryImages.id })
    .from(galleryImages)
    .where(eq(galleryImages.albumId, albumId))
    .orderBy(asc(galleryImages.sortOrder))
  await Promise.all(
    images.map((image, index) =>
      db.update(galleryImages).set({ sortOrder: index }).where(eq(galleryImages.id, image.id))
    )
  )
}
