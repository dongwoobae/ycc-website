import { and, desc, inArray, isNotNull } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { sermons } from '../src/lib/db/schema'
import { manualSummarize } from '../src/lib/sermons/summarize'

function parseLimit(argv: string[]): number {
  const i = argv.indexOf('--limit')
  if (i >= 0 && argv[i + 1]) {
    const n = Number(argv[i + 1])
    if (Number.isFinite(n) && n > 0) return Math.floor(n)
  }
  return 5
}

async function main() {
  const limit = parseLimit(process.argv)
  console.log(`[summarize] picking up to ${limit} sermon(s) needing a summary`)

  const targets = await db
    .select({ id: sermons.id, title: sermons.title })
    .from(sermons)
    .where(and(isNotNull(sermons.youtubeVideoId), inArray(sermons.summaryStatus, ['none', 'failed'])))
    .orderBy(desc(sermons.sermonDate))
    .limit(limit)

  console.log(`[summarize] ${targets.length} target(s)`)

  let ready = 0
  let failed = 0
  for (const t of targets) {
    process.stdout.write(`[summarize] ${t.title.slice(0, 40)} ... `)
    try {
      const status = await manualSummarize(t.id)
      console.log(status)
      if (status === 'ready') ready++
      else failed++
    } catch (e) {
      failed++
      console.log('error:', e instanceof Error ? e.message : e)
    }
  }

  console.log(`[summarize] done. ready=${ready}, failed=${failed}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
