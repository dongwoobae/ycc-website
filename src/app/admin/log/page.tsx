import Link from 'next/link'
import { redirect } from 'next/navigation'
import { and, desc, eq, gte, lt, type SQL } from 'drizzle-orm'
import { canViewServerLog } from '@/lib/admin'
import { verifySession } from '@/lib/dal'
import { db } from '@/lib/db'
import { appLogs, user } from '@/lib/db/schema'
import { formatKstDateTime } from '@/lib/date'
import AdminPageHero from '@/components/admin/AdminPageHero'

const ACTION_OPTIONS = ['create', 'update', 'delete', 'error', 'login', 'logout'] as const
const PAGE_SIZE = 50

const ACTION_BADGE: Record<string, string> = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-orange-100 text-orange-800',
  error: 'bg-red-100 text-red-800',
  login: 'bg-slate-100 text-slate-700',
  logout: 'bg-slate-100 text-slate-700',
}

// entityType별 관리 편집 경로 (알려진 것만 링크화)
const ENTITY_HREF: Record<string, (id: string) => string> = {
  sermon: (id) => `/admin/sermons/${id}/edit`,
  post: (id) => `/admin/posts/${id}/edit`,
  bulletin: (id) => `/admin/bulletins/${id}/edit`,
  gallery_album: (id) => `/admin/gallery/${id}/edit`,
}

/** KST 하루 시작 시각(UTC 절대시각)으로 환산. 무효 형식이면 null. */
function kstDayStart(date?: string): Date | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const d = new Date(`${date}T00:00:00+09:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

const DAY_MS = 24 * 60 * 60 * 1000

export default async function AdminLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; from?: string; to?: string; page?: string }>
}) {
  // 방어심층: nav 숨김과 별개로 URL 직접접근도 차단
  const session = await verifySession()
  if (!canViewServerLog(session.user.email)) redirect('/admin')

  const { action, from, to, page: pageParam } = await searchParams
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1)

  const conditions: SQL[] = []
  if (action && ACTION_OPTIONS.includes(action as (typeof ACTION_OPTIONS)[number])) {
    conditions.push(eq(appLogs.action, action))
  }
  const fromStart = kstDayStart(from)
  if (fromStart) conditions.push(gte(appLogs.createdAt, fromStart))
  const toStart = kstDayStart(to)
  if (toStart) conditions.push(lt(appLogs.createdAt, new Date(toStart.getTime() + DAY_MS)))

  // 다음 페이지 존재 여부 판단을 위해 PAGE_SIZE + 1개 조회
  const rows = await db
    .select({
      id: appLogs.id,
      action: appLogs.action,
      entityType: appLogs.entityType,
      entityId: appLogs.entityId,
      message: appLogs.message,
      createdAt: appLogs.createdAt,
      userName: user.name,
      userEmail: user.email,
    })
    .from(appLogs)
    .leftJoin(user, eq(user.id, appLogs.createdBy))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(appLogs.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE)

  const hasNext = rows.length > PAGE_SIZE
  const pageRows = hasNext ? rows.slice(0, PAGE_SIZE) : rows

  const pageHref = (targetPage: number) => {
    const sp = new URLSearchParams()
    if (action) sp.set('action', action)
    if (from) sp.set('from', from)
    if (to) sp.set('to', to)
    if (targetPage > 1) sp.set('page', String(targetPage))
    const qs = sp.toString()
    return qs ? `/admin/log?${qs}` : '/admin/log'
  }

  return (
    <div>
      <AdminPageHero
        title="서버 로그"
        image="https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1600&q=80"
      />
      <form method="get" className="mb-4 flex flex-wrap items-center gap-3">
        <select
          name="action"
          defaultValue={action ?? ''}
          className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm"
        >
          <option value="">전체 액션</option>
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="from"
          defaultValue={from ?? ''}
          aria-label="시작일"
          className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm"
        />
        <span className="text-ink-muted">~</span>
        <input
          type="date"
          name="to"
          defaultValue={to ?? ''}
          aria-label="종료일"
          className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg border border-line px-4 py-1.5 text-sm font-medium text-ink transition hover:bg-surface"
        >
          조회
        </button>
      </form>
      <div className="overflow-x-auto rounded-xl bg-paper shadow-sm">
        <table className="min-w-[48rem] w-full text-sm">
          <thead className="bg-surface text-ink-muted">
            <tr>
              {['시간', '액션', '대상', 'ID', '메시지', '사용자'].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr className="border-t border-line">
                <td className="px-4 py-3 text-ink-muted" colSpan={6}>
                  로그가 없습니다.
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const href = row.entityId ? ENTITY_HREF[row.entityType]?.(row.entityId) : undefined
                return (
                  <tr key={row.id} className="border-t border-line">
                    <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                      {formatKstDateTime(row.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          ACTION_BADGE[row.action] ?? 'bg-surface text-ink-muted'
                        }`}
                      >
                        {row.action}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{row.entityType}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                      {row.entityId ? (
                        href ? (
                          <Link
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-700 underline-offset-2 hover:underline"
                          >
                            {row.entityId}
                          </Link>
                        ) : (
                          <span className="text-ink-muted">{row.entityId}</span>
                        )
                      ) : (
                        <span className="text-ink-muted">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink">{row.message ?? '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                      {row.userName ?? row.userEmail ?? '-'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-ink-muted">{page}페이지</span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink transition hover:bg-surface"
            >
              이전
            </Link>
          ) : (
            <span className="rounded-lg border border-line px-3 py-1.5 text-ink-muted opacity-50">이전</span>
          )}
          {hasNext ? (
            <Link
              href={pageHref(page + 1)}
              className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink transition hover:bg-surface"
            >
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
