import { config } from 'dotenv'

config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'

// drizzle-kit migrate 우회: 누끼 캐시 컬럼을 idempotent하게 직접 추가한다.
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL 가 .env.local 에 없음')
  const sql = neon(url)
  await sql`ALTER TABLE sermon_thumbnails ADD COLUMN IF NOT EXISTS thumbnail_cutout_url text`
  console.log('thumbnail_cutout_url 컬럼 적용 완료')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
