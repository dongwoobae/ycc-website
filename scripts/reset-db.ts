import { config } from 'dotenv'

config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'

// 런칭 전 DB 초기화용. public 스키마를 통째로 비우고 재생성한다(모든 데이터 삭제).
// 이후 `npm run db:migrate`로 baseline 마이그레이션을 적용한다.
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL 가 .env.local 에 없음')

  const sql = neon(url)
  await sql`DROP SCHEMA IF EXISTS public CASCADE`
  await sql`CREATE SCHEMA public`
  console.log('public 스키마 초기화 완료')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
