import { config } from 'dotenv'
// 로컬 실행 시 .env.local 우선, .env 폴백. 파일이 없으면(예: CI) 기존 process.env 사용.
// dotenv는 이미 설정된 키를 덮어쓰지 않으므로 .env.local 먼저 로드해 우선순위를 준다.
config({ path: '.env.local' })
config()
import { upsertSchedule } from '../src/lib/qstash'

/**
 * QStash 정기 스케줄을 등록/갱신한다(멱등). 콜백 대상은 site-origin 기반 프로덕션 URL.
 * - websub-renew: 2일마다 WebSub 구독 재구독(리스 만료로 신규 업로드 감지가 멈추는 것 방지)
 * - retry-summaries: 매시간 자동요약 실패/미완료 설교 재투입
 */
async function main() {
  await upsertSchedule({ job: 'websub-renew', cron: '0 0 */2 * *', scheduleId: 'ycc-websub-renew' })
  await upsertSchedule({ job: 'retry-summaries', cron: '0 * * * *', scheduleId: 'ycc-retry-summaries' })
  console.log('QStash schedules upserted: websub-renew(2일 0 0 */2 * *), retry-summaries(매시간 0 * * * *)')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
