import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'
import { db } from './db'
import { user, session, account, verification } from './db/auth-schema'
import { normalizeOrigin } from './auth-origin'
import { log } from './logger'

export { normalizeOrigin }

function resolveTrustedOrigins(): string[] {
  const origins = ['http://localhost:3000']
  for (const value of [
    process.env.BETTER_AUTH_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    const origin = normalizeOrigin(value)
    if (origin) origins.push(origin)
  }
  return Array.from(new Set(origins))
}

function resolveBaseUrl() {
  return (
    normalizeOrigin(process.env.BETTER_AUTH_URL) ||
    normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    normalizeOrigin(process.env.VERCEL_URL) ||
    undefined
  )
}

export const auth = betterAuth({
  baseURL: resolveBaseUrl(),
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  session: {
    // 세션을 서명된 쿠키로 캐시해 요청마다 발생하던 세션 DB 왕복(Neon HTTP)을 생략.
    // 트레이드오프: 강제 로그아웃/세션 폐기가 최대 maxAge까지 지연 반영됨.
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  databaseHooks: {
    // 세션 생성 = 로그인. 사용자는 로그 화면에서 created_by 조인으로 표시된다.
    session: {
      create: {
        async after(newSession) {
          await log('login', 'user', undefined, undefined, newSession.userId)
        },
      },
    },
  },
  hooks: {
    // 로그아웃은 세션 삭제 전에 현재 세션을 조회해 기록한다.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-out') return
      const current = await getSessionFromCtx(ctx).catch(() => null)
      if (current?.user?.id) await log('logout', 'user', undefined, undefined, current.user.id)
    }),
  },
  trustedOrigins: resolveTrustedOrigins(),
  plugins: [nextCookies()],
})
