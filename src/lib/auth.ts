import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { db } from './db'
import { user, session, account, verification } from './db/auth-schema'

function resolveTrustedOrigins(): string[] {
  const origins = ['http://localhost:3000']
  if (process.env.BETTER_AUTH_URL) origins.push(process.env.BETTER_AUTH_URL)
  if (process.env.VERCEL_URL) origins.push(`https://${process.env.VERCEL_URL}`)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  return Array.from(new Set(origins))
}

export const auth = betterAuth({
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
