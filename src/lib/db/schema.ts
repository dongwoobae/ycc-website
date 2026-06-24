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
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import type { BulletinSection, SermonChapter } from '../types'

// Better Auth 테이블 (user/session/account/verification) — drizzle push 포함용 재노출
export * from './auth-schema'

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
  displayTitle: text('display_title'),
  preacher: text('preacher'),
  seriesId: uuid('series_id').references(() => sermonSeries.id, { onDelete: 'set null' }),
  worshipType: text('worship_type').notNull().default('주일예배'),
  sermonDate: date('sermon_date').notNull(),
  videoUrl: text('video_url'),
  audioUrl: text('audio_url'),
  notesUrl: text('notes_url'),
  thumbnailUrl: text('thumbnail_url'),
  summary: text('summary'),
  transcriptText: text('transcript_text'),
  transcriptFetchedAt: timestamp('transcript_fetched_at', { withTimezone: true }),
  youtubeVideoId: text('youtube_video_id').unique(),
  durationSeconds: integer('duration_seconds'),
  quickSummary: jsonb('quick_summary').$type<string[]>(),
  chapters: jsonb('chapters').$type<SermonChapter[]>(),
  summaryStatus: text('summary_status').notNull().default('none'),
  summaryAttempts: integer('summary_attempts').notNull().default(0),
  summaryNextRetryAt: timestamp('summary_next_retry_at', { withTimezone: true }),
  summaryGeneratedAt: timestamp('summary_generated_at', { withTimezone: true }),
  summaryModel: text('summary_model'),
  isPublished: boolean('is_published').notNull().default(false),
  createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [index('sermons_published_date_idx').on(t.isPublished, t.sermonDate)])

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
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    check('posts_category_check', sql`${t.category} IN ('공지','소식','행사')`),
    index('posts_published_pinned_at_idx').on(t.isPublished, t.isPinned, t.publishedAt),
  ]
)

export const bulletins = pgTable('bulletins', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  bulletinDate: date('bulletin_date').notNull(),
  volume: text('volume'),
  issue: text('issue'),
  theme: text('theme'),
  scripture: text('scripture'),
  sections: jsonb('sections').$type<BulletinSection[]>().notNull().default(sql`'[]'::jsonb`),
  isPublished: boolean('is_published').notNull().default(false),
  createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
}, (t) => [index('bulletins_published_date_idx').on(t.isPublished, t.bulletinDate)])

export const galleryAlbums = pgTable('gallery_albums', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  description: text('description'),
  coverImgUrl: text('cover_img_url'),
  eventDate: date('event_date'),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [index('gallery_albums_published_event_created_idx').on(t.isPublished, t.eventDate, t.createdAt)])

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
}, (t) => [index('gallery_images_album_sort_idx').on(t.albumId, t.sortOrder)])

export const appLogs = pgTable('app_logs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  message: text('message'),
  createdBy: text('created_by'),
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
