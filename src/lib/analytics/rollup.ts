import 'server-only'

import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { todayKst } from '@/lib/date'

export async function runAnalyticsRollup(today = todayKst()): Promise<{ rolledUp: number; deleted: number }> {
  const rollupResult = await db.execute(sql`
    WITH source_days AS (
      SELECT
        (created_at AT TIME ZONE 'Asia/Seoul')::date AS date,
        count(DISTINCT visitor_id)::int AS unique_visitors,
        count(*)::int AS page_views
      FROM page_views
      WHERE (created_at AT TIME ZONE 'Asia/Seoul')::date < ${today}
      GROUP BY 1
    ),
    inserted AS (
      INSERT INTO daily_page_stats (date, unique_visitors, page_views)
      SELECT s.date, s.unique_visitors, s.page_views
      FROM source_days s
      ON CONFLICT (date) DO UPDATE SET
        unique_visitors = excluded.unique_visitors,
        page_views = excluded.page_views
      RETURNING date
    )
    SELECT count(*)::int AS count FROM inserted
  `)

  const deleteResult = await db.execute(sql`
    WITH deleted AS (
      DELETE FROM page_views
      WHERE created_at < now() - interval '90 days'
      RETURNING id
    )
    SELECT count(*)::int AS count FROM deleted
  `)

  const rollupRows = Array.isArray(rollupResult) ? rollupResult : rollupResult.rows
  const deleteRows = Array.isArray(deleteResult) ? deleteResult : deleteResult.rows

  return {
    rolledUp: Number((rollupRows[0] as { count?: number | string } | undefined)?.count ?? 0),
    deleted: Number((deleteRows[0] as { count?: number | string } | undefined)?.count ?? 0),
  }
}
