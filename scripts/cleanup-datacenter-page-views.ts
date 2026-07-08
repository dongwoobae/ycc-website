import { config } from 'dotenv'

config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { isDatacenterIp } from '../src/lib/analytics/datacenter'

// 수집 차단 이전에 쌓인 데이터센터/스캐너 봇 행을 일회성으로 삭제한다.
// ip_masked는 마지막 옥텟이 0이지만 차단 대역이 전부 /24보다 넓어 그대로 매칭된다.
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL 가 .env.local 에 없음')
  const sql = neon(url)

  const rows = (await sql`SELECT DISTINCT ip_masked FROM page_views WHERE ip_masked IS NOT NULL`) as {
    ip_masked: string
  }[]
  const targets = rows.map((row) => row.ip_masked).filter((ip) => isDatacenterIp(ip))
  if (targets.length === 0) {
    console.log('삭제 대상 없음')
    return
  }

  const deleted = (await sql`
    DELETE FROM page_views WHERE ip_masked = ANY(${targets}) RETURNING id
  `) as { id: string }[]
  console.log(`대상 IP ${targets.length}개 대역, ${deleted.length}행 삭제:`, targets.join(', '))
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
