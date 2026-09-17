import { config } from 'dotenv'
// 로컬 실행 시 .env.local 우선, .env 폴백. 파일이 없으면(예: CI) 기존 process.env 사용.
// dotenv는 이미 설정된 키를 덮어쓰지 않으므로 .env.local 먼저 로드해 우선순위를 준다.
config({ path: '.env.local' })
config()
import { syncSchedules } from '../src/lib/qstash'
import { getCanonicalSiteOrigin } from '../src/lib/site-origin'

/**
 * QStash 정기 스케줄의 desired set을 적용한다. 등록(create)은 멱등이라 항상 실행하고,
 * 목록에서 빠진 ycc- 스케줄 삭제는 --apply 없이는 후보만 출력한다(이 저장소의
 * cleanup-thumbnails.ts·audit-bulletin-r2.ts와 같은 기본값 — 삭제는 실행 취소가 안 된다).
 * 대상 origin은 site-origin 기반 프로덕션 URL — 로컬 실행 시 NEXT_PUBLIC_SITE_URL을 반드시 앞에 붙인다.
 *
 * reconcile-sermons가 설교 등록의 주경로다. 주일·수요 예배 시간대에 매시간 돌리고 매일 1회로 받친다.
 * 시간대를 정한 근거(업로드 시각 분포)와 websub-renew 갱신 주기 근거는
 * docs/specs/2026-09-17-sermon-detection-polling-design.md에 있다.
 */
async function main() {
  const apply = process.argv.includes('--apply')
  const { upserted, deleted, staleManaged } = await syncSchedules(
    [
      { job: 'websub-renew', cron: '0 0 * * *', scheduleId: 'ycc-websub-renew' },
      { job: 'retry-summaries', cron: '0 * * * *', scheduleId: 'ycc-retry-summaries' },
      { job: 'reconcile-sermons', cron: '0 0 * * *', scheduleId: 'ycc-reconcile-sermons' },
      { job: 'reconcile-sermons', cron: '0 2-8 * * 0', scheduleId: 'ycc-reconcile-sermons-sun' },
      { job: 'reconcile-sermons', cron: '0 11-14 * * 3', scheduleId: 'ycc-reconcile-sermons-wed' },
      { job: 'analytics-rollup', cron: '10 15 * * *', scheduleId: 'ycc-analytics-rollup' },
    ],
    apply,
  )
  console.log(`QStash schedules → ${getCanonicalSiteOrigin()}`)
  console.log(`  적용: ${upserted.join(', ')}`)
  if (apply) {
    console.log(`  삭제: ${deleted.length ? deleted.join(', ') : '없음'}`)
  } else {
    console.log(
      `  삭제 예정(--apply 없음, 반영 안 됨): ${staleManaged.length ? staleManaged.join(', ') : '없음'}`,
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
