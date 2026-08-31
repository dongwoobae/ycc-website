import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'

// Vercel 환경변수는 프리뷰·개발 배포에도 같은 DATABASE_URL을 물려주므로, 이 게이트가 없으면
// 브랜치 배포 한 번이 프로덕션 DB에 마이그레이션을 걸어 버린다.
const env = process.env.VERCEL_ENV
if (env !== 'production') {
  console.log(`[migrate] VERCEL_ENV=${env ?? '(미설정)'} — 건너뜀`)
  process.exit(0)
}

if (!process.env.DATABASE_URL) {
  console.error('[migrate] DATABASE_URL이 없다')
  process.exit(1)
}

await migrate(drizzle(neon(process.env.DATABASE_URL)), { migrationsFolder: 'drizzle' })
console.log('[migrate] 적용 완료')
