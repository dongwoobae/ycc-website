import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { sermons, sermonSummaries } from '../src/lib/db/schema'
import { manualSummarize } from '../src/lib/sermons/summarize'
import { autoSummaryTypes } from '../src/lib/worship'

function parseLimit(argv: string[]): number {
  const i = argv.indexOf('--limit')
  if (i >= 0 && argv[i + 1]) {
    const n = Number(argv[i + 1])
    if (Number.isFinite(n) && n > 0) return Math.floor(n)
  }
  return 5
}

/** throw된 에러 메시지를 사유 카테고리로 분류한다(전부 claim 전 단계 — DB status는 'none' 유지). */
function classifyError(msg: string): string {
  if (/rate-limited|timedtext|\b429\b/i.test(msg)) return 'rate-limited(429)·자막fetch'
  if (/yt-api subtitles/i.test(msg)) return 'subtitles-api-error'
  if (msg.includes('자막 미준비')) return 'no-caption·자막없음'
  if (/not claimable/i.test(msg)) return 'not-claimable'
  if (/not found|YouTube video id/i.test(msg)) return 'no-video-id'
  return `other: ${msg}`
}

async function main() {
  const limit = parseLimit(process.argv)
  console.log(`[summarize] picking up to ${limit} sermon(s) needing a summary`)

  const targets = await db
    .select({ id: sermons.id, title: sermons.title })
    .from(sermons)
    .innerJoin(sermonSummaries, eq(sermonSummaries.sermonId, sermons.id))
    .where(
      and(
        isNotNull(sermons.youtubeVideoId),
        inArray(sermonSummaries.summaryStatus, ['none', 'failed']),
        inArray(sermons.worshipType, [...autoSummaryTypes]),
      ),
    )
    .orderBy(desc(sermons.sermonDate))
    .limit(limit)

  console.log(`[summarize] ${targets.length} target(s)`)

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  let ready = 0
  const tally: Record<string, number> = {}
  const bump = (key: string) => {
    tally[key] = (tally[key] ?? 0) + 1
  }

  for (const [i, t] of targets.entries()) {
    if (i > 0) await sleep(5000) // YouTube timedtext rate-limit 회피용 페이싱
    process.stdout.write(`[summarize] ${t.title.slice(0, 40)} ... `)
    try {
      const status = await manualSummarize(t.id)
      if (status === 'ready') {
        ready++
        bump('ready')
        console.log('ready')
      } else {
        bump('gemini-failed(DB=failed)')
        console.log('failed')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      bump(classifyError(msg))
      console.log('error:', msg)
    }
  }

  const failed = targets.length - ready
  console.log(`\n[summarize] done. ready=${ready}, failed=${failed} / total=${targets.length}`)
  console.log('[summarize] 사유별 집계:')
  for (const [reason, count] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason}: ${count}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
