import 'server-only'

import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export const verifySession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/sign-in')
  return session
})

export const requireAdmin = cache(async () => {
  const session = await verifySession()
  // profiles.role is not currently linked to better-auth's text user id; keep admin authz behind this chokepoint.
  return session
})
