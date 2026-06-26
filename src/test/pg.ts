import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from '@/lib/db/schema'

export type TestDb = ReturnType<typeof drizzle<typeof schema>>

/** 인프로세스 Postgres를 띄우고 drizzle/ 마이그레이션을 적용한 테스트 DB를 만든다. */
export async function makeTestDb(): Promise<{ db: TestDb; close: () => Promise<void> }> {
  const client = new PGlite()
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  return { db, close: () => client.close() }
}

/** sermons + (선택) sermon_summaries 기본 행을 만들고 sermon id를 반환한다. */
export async function insertSermonFixture(
  db: TestDb,
  opts: { withSummaryRow?: boolean; summaryStatus?: string; transcriptText?: string } = {}
): Promise<string> {
  const [s] = await db
    .insert(schema.sermons)
    .values({ title: 't', worshipType: '주일예배', sermonDate: '2026-01-01', isPublished: true })
    .returning({ id: schema.sermons.id })
  const id = s.id
  if (opts.withSummaryRow !== false) {
    await db.insert(schema.sermonSummaries).values({ sermonId: id, summaryStatus: opts.summaryStatus ?? 'none' })
  }
  if (opts.transcriptText !== undefined) {
    await db.insert(schema.sermonTranscripts).values({ sermonId: id, transcriptText: opts.transcriptText })
  }
  return id
}
