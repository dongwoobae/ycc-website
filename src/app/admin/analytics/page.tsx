import Link from 'next/link'
import { asc, gte, inArray, sql } from 'drizzle-orm'
import { verifySession } from '@/lib/dal'
import { db } from '@/lib/db'
import { dailyPageStats, pageViews } from '@/lib/db/schema'
import { formatKstDateTime, todayKst } from '@/lib/date'
import AdminPageHero from '@/components/admin/AdminPageHero'

const PAGE_SIZE = 20
const DAY_MS = 24 * 60 * 60 * 1000
const PERIODS = [1, 7, 30] as const

type Period = (typeof PERIODS)[number]

interface SummaryRow {
  visitors: number | string | null
  pageViews: number | string | null
  sessions: number | string | null
  averageSessionDurationSeconds: number | string | null
}

interface SessionRow {
  sessionId: string
  startedAt: Date
  region: string | null
  ipMasked: string | null
  pageCount: number | string
  totalDurationSeconds: number | string | null
}

interface TodayTrendRow {
  date: string
  uniqueVisitors: number | string
  pageViews: number | string
}

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  return ((result as { rows?: T[] }).rows ?? []) as T[]
}

function parsePeriod(value?: string): Period {
  const parsed = Number.parseInt(value ?? '7', 10)
  return PERIODS.includes(parsed as Period) ? (parsed as Period) : 7
}

function kstDateOffset(date: string, offsetDays: number): string {
  const next = new Date(`${date}T00:00:00+09:00`)
  next.setTime(next.getTime() + offsetDays * DAY_MS)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(next)
}

function kstDayStart(date: string): Date {
  return new Date(`${date}T00:00:00+09:00`)
}

function formatDuration(seconds: number | string | null | undefined): string {
  const total = Math.max(0, Number(seconds ?? 0))
  const minutes = Math.floor(total / 60)
  const remain = total % 60
  if (minutes >= 60) return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`
  if (minutes > 0) return `${minutes}분 ${remain}초`
  return `${remain}초`
}

function numberValue(value: number | string | null | undefined): number {
  return Number(value ?? 0)
}

async function loadSummary(days: Period, today: string): Promise<SummaryRow> {
  const from = kstDayStart(kstDateOffset(today, -(days - 1)))
  const to = kstDayStart(kstDateOffset(today, 1))
  const result = await db.execute(sql`
    WITH scoped AS (
      SELECT visitor_id, session_id, duration_seconds
      FROM page_views
      WHERE created_at >= ${from.toISOString()} AND created_at < ${to.toISOString()}
    ),
    sessions AS (
      SELECT session_id, sum(duration_seconds)::int AS duration
      FROM scoped
      GROUP BY session_id
    )
    SELECT
      (SELECT count(DISTINCT visitor_id)::int FROM scoped) AS "visitors",
      (SELECT count(*)::int FROM scoped) AS "pageViews",
      (SELECT count(*)::int FROM sessions) AS "sessions",
      (SELECT coalesce(round(avg(duration)), 0)::int FROM sessions) AS "averageSessionDurationSeconds"
  `)
  return rowsOf<SummaryRow>(result)[0] ?? { visitors: 0, pageViews: 0, sessions: 0, averageSessionDurationSeconds: 0 }
}

async function loadSessions(period: Period, page: number, today: string): Promise<SessionRow[]> {
  const from = kstDayStart(kstDateOffset(today, -(period - 1)))
  const to = kstDayStart(kstDateOffset(today, 1))
  const result = await db.execute(sql`
    SELECT
      session_id AS "sessionId",
      min(created_at) AS "startedAt",
      max(region) AS "region",
      max(ip_masked) AS "ipMasked",
      count(*)::int AS "pageCount",
      coalesce(sum(duration_seconds), 0)::int AS "totalDurationSeconds"
    FROM page_views
    WHERE created_at >= ${from.toISOString()} AND created_at < ${to.toISOString()}
    GROUP BY session_id
    ORDER BY min(created_at) DESC
    LIMIT ${PAGE_SIZE + 1}
    OFFSET ${(page - 1) * PAGE_SIZE}
  `)
  return rowsOf<SessionRow>(result)
}

function periodHref(period: Period) {
  return `/admin/analytics?period=${period}`
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; page?: string }>
}) {
  await verifySession()

  const { period: periodParam, page: pageParam } = await searchParams
  const period = parsePeriod(periodParam)
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1)
  const today = todayKst()
  const trendFrom = kstDateOffset(today, -29)

  const [todaySummary, weekSummary, monthSummary, sessionRows, dailyRows, todayTrend] = await Promise.all([
    loadSummary(1, today),
    loadSummary(7, today),
    loadSummary(30, today),
    loadSessions(period, page, today),
    db
      .select()
      .from(dailyPageStats)
      .where(gte(dailyPageStats.date, trendFrom))
      .orderBy(asc(dailyPageStats.date)),
    db.execute(sql`
      SELECT
        ${today}::date AS "date",
        count(DISTINCT visitor_id)::int AS "uniqueVisitors",
        count(*)::int AS "pageViews"
      FROM page_views
      WHERE (created_at AT TIME ZONE 'Asia/Seoul')::date = ${today}
    `),
  ])

  const hasNext = sessionRows.length > PAGE_SIZE
  const sessions = hasNext ? sessionRows.slice(0, PAGE_SIZE) : sessionRows
  const details = sessions.length
    ? await db
        .select({
          id: pageViews.id,
          sessionId: pageViews.sessionId,
          path: pageViews.path,
          createdAt: pageViews.createdAt,
          durationSeconds: pageViews.durationSeconds,
        })
        .from(pageViews)
        .where(inArray(pageViews.sessionId, sessions.map((row) => row.sessionId)))
        .orderBy(asc(pageViews.sessionId), asc(pageViews.createdAt))
    : []

  const detailsBySession = new Map<string, typeof details>()
  for (const row of details) {
    detailsBySession.set(row.sessionId, [...(detailsBySession.get(row.sessionId) ?? []), row])
  }

  const trend = [
    ...dailyRows
      .filter((row) => row.date !== today)
      .map((row) => ({
        date: row.date,
        uniqueVisitors: row.uniqueVisitors,
        pageViews: row.pageViews,
      })),
    ...(rowsOf<TodayTrendRow>(todayTrend)[0] ? [rowsOf<TodayTrendRow>(todayTrend)[0]] : []),
  ].slice(-30)

  const summaryCards = [
    ['오늘', todaySummary],
    ['최근 7일', weekSummary],
    ['최근 30일', monthSummary],
  ] as const

  const pageHref = (targetPage: number) => `/admin/analytics?period=${period}&page=${targetPage}`

  return (
    <div>
      <AdminPageHero
        title="접속 분석"
        subtitle="방문자 수는 일일 순방문자 근사치, 체류시간은 근사값입니다."
        image="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80"
      />

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {summaryCards.map(([label, row]) => (
          <section key={label} className="rounded-xl bg-paper p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-ink-muted">{label}</h2>
            <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-ink-muted">방문자</dt>
                <dd className="mt-1 text-xl font-bold text-ink">{numberValue(row.visitors).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">PV</dt>
                <dd className="mt-1 text-xl font-bold text-ink">{numberValue(row.pageViews).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">근사 체류</dt>
                <dd className="mt-1 text-xl font-bold text-ink">
                  {formatDuration(row.averageSessionDurationSeconds)}
                </dd>
              </div>
            </dl>
          </section>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {PERIODS.map((value) => (
          <Link
            key={value}
            href={periodHref(value)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
              period === value ? 'border-ink bg-ink text-bg' : 'border-line text-ink hover:bg-surface'
            }`}
          >
            {value === 1 ? '오늘' : `최근 ${value}일`}
          </Link>
        ))}
      </div>

      <section className="mb-6 rounded-xl bg-paper p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-ink">일별 추이</h2>
        <div className="overflow-x-auto">
          <table className="min-w-[36rem] w-full text-sm">
            <thead className="bg-surface text-ink-muted">
              <tr>
                {['날짜', '방문자', 'PV'].map((heading) => (
                  <th key={heading} className="px-4 py-2 text-left font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trend.map((row) => (
                <tr key={row.date} className="border-t border-line">
                  <td className="px-4 py-2 text-ink-muted">{row.date}</td>
                  <td className="px-4 py-2 font-medium text-ink">{numberValue(row.uniqueVisitors).toLocaleString()}</td>
                  <td className="px-4 py-2 font-medium text-ink">{numberValue(row.pageViews).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="overflow-x-auto rounded-xl bg-paper shadow-sm">
        <table className="min-w-[56rem] w-full text-sm">
          <thead className="bg-surface text-ink-muted">
            <tr>
              <th colSpan={5} className="px-4 py-3 font-medium">
                <div className="grid grid-cols-[1.5fr_1fr_1fr_0.7fr_1fr] gap-4 text-left">
                  <span>시작시각</span>
                  <span>지역</span>
                  <span>IP</span>
                  <span>페이지수</span>
                  <span>총 체류</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr className="border-t border-line">
                <td className="px-4 py-3 text-ink-muted" colSpan={5}>
                  접속 기록이 없습니다.
                </td>
              </tr>
            ) : (
              sessions.map((row) => (
                <tr key={row.sessionId} className="border-t border-line align-top">
                  <td className="px-4 py-3" colSpan={5}>
                    <details>
                      <summary className="grid cursor-pointer list-none grid-cols-[1.5fr_1fr_1fr_0.7fr_1fr] gap-4 text-left [&::-webkit-details-marker]:hidden">
                        <span className="text-ink-muted">{formatKstDateTime(row.startedAt)}</span>
                        <span>{row.region || '알수없음'}</span>
                        <span className="font-mono text-xs text-ink-muted">{row.ipMasked || '-'}</span>
                        <span>{numberValue(row.pageCount).toLocaleString()}</span>
                        <span>{formatDuration(row.totalDurationSeconds)}</span>
                      </summary>
                      <div className="mt-3 border-t border-line pt-3">
                        {(detailsBySession.get(row.sessionId) ?? []).map((item) => (
                          <div key={item.id} className="grid grid-cols-[10rem_1fr_7rem] gap-3 py-1 text-xs">
                            <span className="text-ink-muted">{formatKstDateTime(item.createdAt)}</span>
                            <span className="break-all font-medium text-ink">{item.path}</span>
                            <span className="text-right text-ink-muted">{formatDuration(item.durationSeconds)}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-ink-muted">{page}페이지</span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink">
              이전
            </Link>
          ) : (
            <span className="rounded-lg border border-line px-3 py-1.5 text-ink-muted opacity-50">이전</span>
          )}
          {hasNext ? (
            <Link href={pageHref(page + 1)} className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink">
              다음
            </Link>
          ) : (
            <span className="rounded-lg border border-line px-3 py-1.5 text-ink-muted opacity-50">다음</span>
          )}
        </div>
      </div>
    </div>
  )
}
