import { config } from 'dotenv'

config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'

// 'no_transcript' 상태 도입 이전에 자막 미생성으로 failed 처리된 건을 일회성으로 재분류한다.
//
// failed + 자막 없음 조합은 fetch-transcript의 재시도 포기 경로에서만 나온다:
//  - summarize 발행 실패(route.ts)와 Gemini 요약 실패(summarize.ts)는 둘 다 자막이 이미 저장된 뒤에만 failed를 쓴다.
//  - manualSummarize는 자막을 못 받으면 상태를 건드리기 전에 throw 한다.
// 따라서 자막 행이 없는 failed는 전부 '유튜브가 자막을 안 만든 건'으로 안전하게 단정할 수 있다.
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL 가 .env.local 에 없음')
  const sql = neon(url)

  const rows = (await sql`
    UPDATE sermon_summaries AS ss
    SET summary_status = 'no_transcript'
    FROM sermons s
    LEFT JOIN sermon_transcripts t ON t.sermon_id = s.id
    WHERE ss.sermon_id = s.id
      AND ss.summary_status = 'failed'
      AND (t.transcript_text IS NULL OR btrim(t.transcript_text) = '')
    RETURNING s.id, s.sermon_date, s.title
  `) as { id: string; sermon_date: string; title: string }[]

  if (rows.length === 0) {
    console.log('재분류 대상 없음')
    return
  }
  console.log(`${rows.length}건을 no_transcript로 재분류:`)
  for (const row of rows) console.log(`  ${row.sermon_date}  ${row.title}`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
