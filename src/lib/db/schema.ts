import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  date,
  timestamp,
  jsonb,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import type { BulletinSection } from '../types'

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  fullName: text('full_name'),
  role: text('role').notNull().default('staff'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const sermonSeries = pgTable('sermon_series', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  description: text('description'),
  coverImgUrl: text('cover_img_url'),
  startedAt: date('started_at'),
  endedAt: date('ended_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const sermons = pgTable('sermons', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  preacher: text('preacher').notNull(),
  scripture: text('scripture'),
  seriesId: uuid('series_id').references(() => sermonSeries.id, { onDelete: 'set null' }),
  worshipType: text('worship_type').notNull().default('주일예배'),
  sermonDate: date('sermon_date').notNull(),
  videoUrl: text('video_url'),
  audioUrl: text('audio_url'),
  notesUrl: text('notes_url'),
  thumbnailUrl: text('thumbnail_url'),
  summary: text('summary'),
  viewCount: integer('view_count').notNull().default(0),
  isPublished: boolean('is_published').notNull().default(false),
  createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    title: text('title').notNull(),
    content: text('content'),
    category: text('category').notNull().default('공지'),
    thumbnailUrl: text('thumbnail_url'),
    attachmentUrl: text('attachment_url'),
    isPinned: boolean('is_pinned').notNull().default(false),
    isPublished: boolean('is_published').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [check('posts_category_check', sql`${t.category} IN ('공지','소식','행사')`)]
)

export const bulletins = pgTable('bulletins', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  bulletinDate: date('bulletin_date').notNull(),
  volume: text('volume'),
  issue: text('issue'),
  theme: text('theme'),
  scripture: text('scripture'),
  sections: jsonb('sections').$type<BulletinSection[]>().notNull().default(sql`'[]'::jsonb`),
  hwpSourceUrl: text('hwp_source_url'),
  isPublished: boolean('is_published').notNull().default(false),
  createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const galleryAlbums = pgTable('gallery_albums', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  description: text('description'),
  coverImgUrl: text('cover_img_url'),
  eventDate: date('event_date'),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const galleryImages = pgTable('gallery_images', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  albumId: uuid('album_id')
    .notNull()
    .references(() => galleryAlbums.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),
  caption: text('caption'),
  alt: text('alt'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const appLogs = pgTable('app_logs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  message: text('message'),
  createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export type Profile = typeof profiles.$inferSelect
export type SermonRow = typeof sermons.$inferSelect
export type SermonSeries = typeof sermonSeries.$inferSelect
export type PostRow = typeof posts.$inferSelect
export type BulletinRow = typeof bulletins.$inferSelect
export type GalleryAlbumRow = typeof galleryAlbums.$inferSelect
export type GalleryImageRow = typeof galleryImages.$inferSelect
export type AppLog = typeof appLogs.$inferSelect
