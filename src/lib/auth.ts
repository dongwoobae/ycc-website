import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { db } from './db'
import { user, session, account, verification } from './db/auth-schema'
import { normalizeOrigin } from './auth-origin'

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
  trustedOrigins: resolveTrustedOrigins(),
  plugins: [nextCookies()],
})
