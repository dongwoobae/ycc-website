import { config } from 'dotenv'

config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'

// drizzle-kit migrate 우회: 0017 page_views 지리 컬럼을 idempotent하게 직접 추가한다.
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL 가 .env.local 에 없음')
  const sql = neon(url)
  await sql`ALTER TABLE page_views ADD COLUMN IF NOT EXISTS country text`
  await sql`ALTER TABLE page_views ADD COLUMN IF NOT EXISTS country_region text`
  console.log('page_views country/country_region 컬럼 적용 완료')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
