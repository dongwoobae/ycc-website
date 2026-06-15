import { asc, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  galleryAlbums as albumsTable,
  galleryImages as imagesTable,
  type GalleryAlbumRow,
  type GalleryImageRow,
} from '@/lib/db/schema'
import type { GalleryAlbum, GalleryImage } from '@/lib/types'

function toAlbum(row: GalleryAlbumRow, images: GalleryImage[]): GalleryAlbum {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    coverImgUrl: row.coverImgUrl ?? '',
    eventDate: row.eventDate ?? '',
    images,
    isPublished: row.isPublished,
  }
}

function toImage(row: GalleryImageRow): GalleryImage {
  return {
    id: row.id,
    imageUrl: row.imageUrl,
    caption: row.caption ?? undefined,
    alt: row.alt ?? '',
  }
}

export async function getGalleryAlbums(): Promise<GalleryAlbum[]> {
  const rows = await db
    .select()
    .from(albumsTable)
    .where(eq(albumsTable.isPublished, true))
    .orderBy(desc(albumsTable.eventDate))
  return rows.map((row) => toAlbum(row, []))
}

export async function getGalleryAlbumById(id: string): Promise<GalleryAlbum | undefined> {
  const rows = await db.select().from(albumsTable).where(eq(albumsTable.id, id)).limit(1)
  const album = rows[0]
  if (!album) return undefined
  const imageRows = await db
    .select()
    .from(imagesTable)
    .where(eq(imagesTable.albumId, id))
    .orderBy(asc(imagesTable.sortOrder))
  return toAlbum(album, imageRows.map(toImage))
}
