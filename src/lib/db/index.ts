import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

function createDb() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is not set')
  // 드라이버 기본값은 호스트명을 Neon 클라우드 규칙(ep-*.* → api.*, https)으로 변환한다.
  // 그 규칙 밖의 Postgres(CI의 로컬 프록시)에 붙일 때만 종점을 통째로 갈아끼운다.
  const proxy = process.env.NEON_HTTP_PROXY
  if (proxy) neonConfig.fetchEndpoint = proxy
  const sql = neon(databaseUrl)
  return drizzle(sql, { schema })
}

export const db = createDb()
export { schema }
