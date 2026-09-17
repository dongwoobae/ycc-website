import { config } from 'dotenv'
// 로컬 실행 시 .env.local 우선, .env 폴백. 파일이 없으면(예: CI) 기존 process.env 사용.
// dotenv는 이미 설정된 키를 덮어쓰지 않으므로 .env.local 먼저 로드해 우선순위를 준다.
config({ path: '.env.local' })
config()
import { syncSchedules } from '../src/lib/qstash'
import { getCanonicalSiteOrigin } from '../src/lib/site-origin'

/**
 * QStash 정기 스케줄의 desired set을 적용한다(멱등). 목록에서 빠진 ycc- 스케줄은 삭제된다.
 * 대상 origin은 site-origin 기반 프로덕션 URL — 로컬 실행 시 NEXT_PUBLIC_SITE_URL을 반드시 앞에 붙인다.
 *
 * reconcile-sermons가 설교 등록의 주경로다. 주일·수요 예배 시간대에 매시간 돌리고 매일 1회로 받친다.
 * 시간대를 정한 근거(업로드 시각 분포)는 docs/specs/2026-09-17-sermon-detection-polling-design.md에 있다.
 * websub-renew는 부경로 유지용이다. 허브 리스가 5일이라 매일이면 연속 4회 실패까지 견딘다.
 */
async function main() {
  const { upserted, deleted } = await syncSchedules([
    { job: 'websub-renew', cron: '0 0 * * *', scheduleId: 'ycc-websub-renew' },
    { job: 'retry-summaries', cron: '0 * * * *', scheduleId: 'ycc-retry-summaries' },
    { job: 'reconcile-sermons', cron: '0 0 * * *', scheduleId: 'ycc-reconcile-sermons' },
    { job: 'reconcile-sermons', cron: '0 2-8 * * 0', scheduleId: 'ycc-reconcile-sermons-sun' },
    { job: 'reconcile-sermons', cron: '0 11-14 * * 3', scheduleId: 'ycc-reconcile-sermons-wed' },
    { job: 'analytics-rollup', cron: '10 15 * * *', scheduleId: 'ycc-analytics-rollup' },
  ])
  console.log(`QStash schedules → ${getCanonicalSiteOrigin()}`)
  console.log(`  적용: ${upserted.join(', ')}`)
  console.log(`  삭제: ${deleted.length ? deleted.join(', ') : '없음'}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
