import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bulletins as bulletinsTable, type BulletinRow } from '@/lib/db/schema'
import { churchInfo } from '@/lib/church'
import type { Bulletin } from '@/lib/types'

function toBulletin(row: BulletinRow): Bulletin {
  return {
    id: row.id,
    bulletinDate: row.bulletinDate,
    volume: row.volume ?? '',
    issue: row.issue ?? '',
    theme: row.theme ?? '',
    scripture: row.scripture ?? '',
    churchInfo,
    sections: row.sections ?? [],
    isPublished: row.isPublished,
  }
}

export async function getBulletins(): Promise<Bulletin[]> {
  const rows = await db
    .select()
    .from(bulletinsTable)
    .where(eq(bulletinsTable.isPublished, true))
    .orderBy(desc(bulletinsTable.bulletinDate))
  return rows.map(toBulletin)
}

export async function getBulletinById(id: string): Promise<Bulletin | undefined> {
  const rows = await db
    .select()
    .from(bulletinsTable)
    .where(and(eq(bulletinsTable.id, id), eq(bulletinsTable.isPublished, true)))
    .limit(1)
  return rows[0] ? toBulletin(rows[0]) : undefined
}

export async function getLatestBulletin(): Promise<Bulletin | undefined> {
  const rows = await db
    .select()
    .from(bulletinsTable)
    .where(eq(bulletinsTable.isPublished, true))
    .orderBy(desc(bulletinsTable.bulletinDate))
    .limit(1)
  return rows[0] ? toBulletin(rows[0]) : undefined
}
