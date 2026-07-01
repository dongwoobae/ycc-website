import { and, eq, gt, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { pageViews } from '@/lib/db/schema'
import { formatKstDate } from '@/lib/date'
import { isBot } from '@/lib/analytics/bots'
import { hashVisitor, maskIp, sessionId } from '@/lib/analytics/ip'
import { isTrackablePath } from '@/lib/analytics/paths'
import { clampDurationSeconds } from '@/lib/analytics/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TrackPayload =
  | { type: 'pageview'; viewId: string; path: string; referrer?: string | null }
  | { type: 'heartbeat' | 'leave'; viewId: string; path: string; seconds: number }

const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX = 120
const rateLimit = new Map<string, { count: number; resetAt: number }>()

function noContent(): Response {
  return new Response(null, { status: 204 })
}

function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip') || '127.0.0.1'
}

function getRegion(headers: Headers): string | null {
  const value = headers.get('x-vercel-ip-city') || headers.get('x-vercel-ip-region')
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function isRateLimited(visitorId: string, nowMs: number): boolean {
  const current = rateLimit.get(visitorId)
  if (!current || current.resetAt <= nowMs) {
    rateLimit.set(visitorId, { count: 1, resetAt: nowMs + RATE_LIMIT_WINDOW_MS })
    return false
  }
  current.count += 1
  return current.count > RATE_LIMIT_MAX
}

function validPayload(value: unknown): value is TrackPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<TrackPayload>
  if (typeof payload.viewId !== 'string' || !payload.viewId) return false
  if (typeof payload.path !== 'string') return false
  if (payload.type === 'pageview') return true
  if (payload.type === 'heartbeat' || payload.type === 'leave') return typeof payload.seconds === 'number'
  return false
}

export async function POST(req: Request) {
  try {
    const raw = await req.text()
    const parsed = raw ? JSON.parse(raw) : null
    if (!validPayload(parsed)) return noContent()
    if (!isTrackablePath(parsed.path)) return noContent()

    const session = await auth.api.getSession({ headers: req.headers }).catch(() => null)
    if (session) return noContent()

    const userAgent = req.headers.get('user-agent') ?? ''
    if (isBot(userAgent)) return noContent()

    const now = new Date()
    const kstDate = formatKstDate(now)
    const ip = getClientIp(req.headers)
    const visitorId = hashVisitor(process.env.ANALYTICS_SALT, kstDate, ip, userAgent)
    if (isRateLimited(visitorId, now.getTime())) return noContent()

    if (parsed.type === 'pageview') {
      await db
        .insert(pageViews)
        .values({
          id: parsed.viewId,
          visitorId,
          sessionId: sessionId(visitorId, kstDate, now.getTime()),
          path: parsed.path,
          referrer: parsed.referrer?.slice(0, 2048) || null,
          region: getRegion(req.headers),
          ipMasked: maskIp(ip),
          userAgent: userAgent.slice(0, 1024) || null,
          durationSeconds: 0,
        })
        .onConflictDoNothing()
      return noContent()
    }

    const seconds = clampDurationSeconds(parsed.seconds)
    await db
      .update(pageViews)
      .set({ durationSeconds: sql`greatest(${pageViews.durationSeconds}, ${seconds})` })
      .where(
        and(
          eq(pageViews.id, parsed.viewId),
          eq(pageViews.visitorId, visitorId),
          gt(pageViews.createdAt, sql`now() - interval '3 hours'`),
        ),
      )
    return noContent()
  } catch (error) {
    console.error('[analytics] track failed', error)
    return noContent()
  }
}
