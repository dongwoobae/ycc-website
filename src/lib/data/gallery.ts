import { and, asc, count, desc, eq } from 'drizzle-orm'
import { requireAdmin } from '@/lib/dal'
import { db } from '@/lib/db'
import {
  galleryAlbums as albumsTable,
  galleryImages as imagesTable,
  type GalleryAlbumRow,
  type GalleryImageRow,
} from '@/lib/db/schema'
import type { GalleryAlbum, GalleryImage } from '@/lib/types'

type AlbumListRow = Pick<GalleryAlbumRow, 'id' | 'title' | 'description' | 'coverImgUrl' | 'eventDate' | 'isPublished'>
type ImageListRow = Pick<GalleryImageRow, 'id' | 'imageUrl' | 'caption' | 'alt'>

const albumColumns = {
  id: albumsTable.id,
  title: albumsTable.title,
  description: albumsTable.description,
  coverImgUrl: albumsTable.coverImgUrl,
  eventDate: albumsTable.eventDate,
  isPublished: albumsTable.isPublished,
}

const imageColumns = {
  id: imagesTable.id,
  imageUrl: imagesTable.imageUrl,
  caption: imagesTable.caption,
  alt: imagesTable.alt,
}

function toAlbum(row: AlbumListRow, images: GalleryImage[], imageCount?: number): GalleryAlbum {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    coverImgUrl: row.coverImgUrl ?? '',
    eventDate: row.eventDate ?? '',
    images,
    imageCount: imageCount ?? images.length,
    isPublished: row.isPublished,
  }
}

function toImage(row: ImageListRow): GalleryImage {
  return {
    id: row.id,
    imageUrl: row.imageUrl,
    caption: row.caption ?? undefined,
    alt: row.alt ?? '',
  }
}

export async function getGalleryAlbums(): Promise<GalleryAlbum[]> {
  const rows = await db
    .select(albumColumns)
    .from(albumsTable)
    .where(eq(albumsTable.isPublished, true))
    .orderBy(desc(albumsTable.eventDate))
  const countRows = await db
    .select({ albumId: imagesTable.albumId, total: count() })
    .from(imagesTable)
    .groupBy(imagesTable.albumId)
  const countByAlbum = new Map(countRows.map((row) => [row.albumId, row.total]))
  return rows.map((row) => toAlbum(row, [], countByAlbum.get(row.id) ?? 0))
}

export async function getGalleryAlbumById(id: string): Promise<GalleryAlbum | undefined> {
  const rows = await db
    .select(albumColumns)
    .from(albumsTable)
    .where(and(eq(albumsTable.id, id), eq(albumsTable.isPublished, true)))
    .limit(1)
  const album = rows[0]
  if (!album) return undefined
  const imageRows = await db
    .select(imageColumns)
    .from(imagesTable)
    .where(eq(imagesTable.albumId, id))
    .orderBy(asc(imagesTable.sortOrder))
  return toAlbum(album, imageRows.map(toImage))
}

export async function getAlbumForAdmin(id: string): Promise<GalleryAlbum | undefined> {
  await requireAdmin()
  const rows = await db.select(albumColumns).from(albumsTable).where(eq(albumsTable.id, id)).limit(1)
  const album = rows[0]
  if (!album) return undefined
  const imageRows = await db
    .select(imageColumns)
    .from(imagesTable)
    .where(eq(imagesTable.albumId, id))
    .orderBy(asc(imagesTable.sortOrder))
  return toAlbum(album, imageRows.map(toImage))
}
