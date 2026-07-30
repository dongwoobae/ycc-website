import { and, asc, desc, eq, gt, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bulletins as bulletinsTable, type BulletinRow } from '@/lib/db/schema'
import type { Bulletin } from '@/lib/types'

type BulletinListRow = Pick<
  BulletinRow,
  | 'id'
  | 'bulletinDate'
  | 'volume'
  | 'issue'
  | 'sermonTitle'
  | 'scripture'
  | 'preacher'
  | 'hymns'
  | 'responsiveReading'
  | 'nextWeek'
  | 'pdfUrl'
  | 'notices'
  | 'pages'
  | 'isPublished'
>

const bulletinColumns = {
  id: bulletinsTable.id,
  bulletinDate: bulletinsTable.bulletinDate,
  volume: bulletinsTable.volume,
  issue: bulletinsTable.issue,
  sermonTitle: bulletinsTable.sermonTitle,
  scripture: bulletinsTable.scripture,
  preacher: bulletinsTable.preacher,
  hymns: bulletinsTable.hymns,
  responsiveReading: bulletinsTable.responsiveReading,
  nextWeek: bulletinsTable.nextWeek,
  pdfUrl: bulletinsTable.pdfUrl,
  notices: bulletinsTable.notices,
  pages: bulletinsTable.pages,
  isPublished: bulletinsTable.isPublished,
}

function toBulletin(row: BulletinListRow): Bulletin {
  return {
    id: row.id,
    bulletinDate: row.bulletinDate,
    volume: row.volume ?? '',
    issue: row.issue ?? '',
    sermonTitle: row.sermonTitle ?? '',
    scripture: row.scripture ?? '',
    preacher: row.preacher ?? '',
    hymns: row.hymns ?? '',
    responsiveReading: row.responsiveReading ?? '',
    nextWeek: row.nextWeek ?? '',
    ...(row.pdfUrl ? { pdfUrl: row.pdfUrl } : {}),
    notices: row.notices ?? [],
    pages: row.pages ?? [],
    isPublished: row.isPublished,
  }
}

export async function getBulletins(): Promise<Bulletin[]> {
  const rows = await db
    .select(bulletinColumns)
    .from(bulletinsTable)
    .where(eq(bulletinsTable.isPublished, true))
    .orderBy(desc(bulletinsTable.bulletinDate))
  return rows.map(toBulletin)
}

export async function getBulletinById(id: string): Promise<Bulletin | undefined> {
  const rows = await db
    .select(bulletinColumns)
    .from(bulletinsTable)
    .where(and(eq(bulletinsTable.id, id), eq(bulletinsTable.isPublished, true)))
    .limit(1)
  return rows[0] ? toBulletin(rows[0]) : undefined
}

export async function getLatestBulletin(): Promise<Bulletin | undefined> {
  const rows = await db
    .select(bulletinColumns)
    .from(bulletinsTable)
    .where(eq(bulletinsTable.isPublished, true))
    .orderBy(desc(bulletinsTable.bulletinDate))
    .limit(1)
  return rows[0] ? toBulletin(rows[0]) : undefined
}

export interface BulletinNeighbor {
  id: string
  bulletinDate: string
}

/**
 * 상세 화면의 이전/다음 이동용. bulletin_date에 unique 제약이 있으므로
 * 날짜 비교만으로 인접 주보가 하나로 결정된다.
 */
export async function getAdjacentBulletins(
  bulletinDate: string
): Promise<{ previous?: BulletinNeighbor; next?: BulletinNeighbor }> {
  const columns = { id: bulletinsTable.id, bulletinDate: bulletinsTable.bulletinDate }

  const [previous] = await db
    .select(columns)
    .from(bulletinsTable)
    .where(and(eq(bulletinsTable.isPublished, true), lt(bulletinsTable.bulletinDate, bulletinDate)))
    .orderBy(desc(bulletinsTable.bulletinDate))
    .limit(1)

  const [next] = await db
    .select(columns)
    .from(bulletinsTable)
    .where(and(eq(bulletinsTable.isPublished, true), gt(bulletinsTable.bulletinDate, bulletinDate)))
    .orderBy(asc(bulletinsTable.bulletinDate))
    .limit(1)

  return {
    ...(previous ? { previous } : {}),
    ...(next ? { next } : {}),
  }
}
