'use server'

import { revalidatePath } from 'next/cache'
import { desc, eq } from 'drizzle-orm'
import { requireAdmin } from '@/lib/dal'
import { db } from '@/lib/db'
import { bulletins } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import { deleteFromR2, keyFromUrl } from '@/lib/r2'
import { parseHwp } from '@/lib/hwp/parse'
import type { BulletinSection } from '@/lib/types'
import { sniffHwpMime } from '@/lib/upload-sniff'

const maxHwpSize = 10 * 1024 * 1024

export interface BulletinFormInput {
  bulletinDate: string
  volume: string
  issue: string
  theme: string
  scripture: string
  sections: BulletinSection[]
  hwpSourceUrl?: string
}

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

function parseBulletinDate(value: string) {
  const date = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('bulletinDate is required')
  return date
}

function cleanLines(values: unknown) {
  return Array.isArray(values) ? values.map((v) => String(v).trim()).filter(Boolean) : []
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function cleanSections(sections: unknown) {
  if (!Array.isArray(sections)) throw new Error('invalid sections')
  return sections
    .map((value) => {
      const section = asRecord(value)
      return {
        id: typeof section.id === 'string' && section.id ? section.id : crypto.randomUUID(),
        title: String(section.title ?? '').trim(),
        body: cleanLines(section.body),
        rows: Array.isArray(section.rows)
          ? section.rows
            .map((value) => {
              const row = asRecord(value)
              return { label: String(row.label ?? '').trim(), value: String(row.value ?? '').trim() }
            })
            .filter((row) => row.label && row.value)
          : [],
        tables: Array.isArray(section.tables)
          ? section.tables.map(cleanTable).filter((table) => table.title && table.headers.length && table.rows.length)
          : [],
        offerings: Array.isArray(section.offerings)
          ? section.offerings.map(cleanOffering).filter((item) => item.category && item.names.length)
          : [],
      }
    })
    .filter((section) => section.title && (section.body.length || section.rows.length || section.tables.length || section.offerings.length))
    .map((section) => ({
      id: section.id,
      title: section.title,
      ...(section.body.length ? { body: section.body } : {}),
      ...(section.rows.length ? { rows: section.rows } : {}),
      ...(section.tables.length ? { tables: section.tables } : {}),
      ...(section.offerings.length ? { offerings: section.offerings } : {}),
    }))
}

function cleanTable(value: unknown) {
  const table = asRecord(value)
  const headers = cleanLines(table.headers)
  return {
    title: String(table.title ?? '').trim(),
    headers,
    rows: Array.isArray(table.rows)
      ? table.rows.map((row) => cleanLines(row).slice(0, headers.length || undefined)).filter((row) => row.length)
      : [],
  }
}

function cleanOffering(value: unknown) {
  const item = asRecord(value)
  return { category: String(item.category ?? '').trim(), names: cleanLines(item.names) }
}

function parseInput(input: BulletinFormInput) {
  const sections = cleanSections(input.sections)
  if (sections.length === 0) throw new Error('section is required')
  return {
    bulletinDate: parseBulletinDate(input.bulletinDate),
    volume: input.volume.trim() || null,
    issue: input.issue.trim() || null,
    theme: input.theme.trim() || null,
    scripture: input.scripture.trim() || null,
    sections,
    hwpSourceUrl: input.hwpSourceUrl?.trim() || null,
  }
}

function getHwpFile(formData: FormData) {
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) throw new Error('hwp file is required')
  if (file.size > maxHwpSize) throw new Error('hwp must be 10MB or less')
  if (!file.name.toLowerCase().endsWith('.hwp')) throw new Error('hwp file only')
  return file
}

export async function parseHwpAction(formData: FormData) {
  await requireSession()
  const file = getHwpFile(formData)
  const buffer = Buffer.from(await file.arrayBuffer())
  if (!sniffHwpMime(buffer)) throw new Error('invalid hwp file')
  const parsed = parseHwp(buffer)
  return {
    hwpSourceUrl: '',
    sections: [{ id: 'draft', title: '추출 내용', body: parsed.paragraphs }] satisfies BulletinSection[],
  }
}

export async function createBulletin(input: BulletinFormInput) {
  const s = await requireSession()
  const values = parseInput(input)
  const [created] = await db
    .insert(bulletins)
    .values({ ...values, isPublished: true, createdBy: null })
    .returning({ id: bulletins.id, title: bulletins.bulletinDate })
  if (!created) throw new Error('failed to create bulletin')
  await log('create', 'bulletin', created.id, created.title, s.user.id)
  revalidateBulletinPaths(created.id)
  return created.id
}

export async function updateBulletin(id: string, input: BulletinFormInput) {
  const s = await requireSession()
  const values = parseInput(input)
  const [current] = await db.select().from(bulletins).where(eq(bulletins.id, id)).limit(1)
  const [updated] = await db
    .update(bulletins)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(bulletins.id, id))
    .returning({ id: bulletins.id, title: bulletins.bulletinDate })
  if (!updated) throw new Error('bulletin not found')
  if (current?.hwpSourceUrl && current.hwpSourceUrl !== values.hwpSourceUrl) {
    await deleteR2BestEffort(keyFromUrl(current.hwpSourceUrl), s.user.id)
  }
  await log('update', 'bulletin', updated.id, updated.title, s.user.id)
  revalidateBulletinPaths(updated.id)
}

export async function deleteBulletin(id: string) {
  const s = await requireSession()
  const [current] = await db.select().from(bulletins).where(eq(bulletins.id, id)).limit(1)
  const [deleted] = await db
    .delete(bulletins)
    .where(eq(bulletins.id, id))
    .returning({ id: bulletins.id, title: bulletins.bulletinDate })
  if (!deleted) throw new Error('bulletin not found')
  await deleteR2BestEffort(keyFromUrl(current?.hwpSourceUrl), s.user.id)
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
