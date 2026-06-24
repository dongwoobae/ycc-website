import Link from 'next/link'
import type { AdminDashboardStats, CountPair, FailedSermon } from '@/lib/data/admin-dashboard'
import { sermonListTitle } from '@/lib/sermons/list-title'

function StatCard({ label, href, pair }: { label: string; href: string; pair: CountPair }) {
  return (
    <Link href={href} className="rounded-xl bg-paper p-5 shadow-sm transition hover:shadow-md">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold text-ink">{pair.total}</p>
      <p className="mt-1 text-xs text-ink-muted">
        공개 {pair.published} · 비공개 {pair.total - pair.published}
      </p>
    </Link>
  )
}

function SummaryBadge({ label, value, tone }: { label: string; value: number; tone?: 'accent' | 'danger' }) {
  const color = tone === 'danger' ? 'text-red-600' : tone === 'accent' ? 'text-accent-deep' : 'text-ink'
  return (
    <div className="rounded-lg border border-line bg-paper px-4 py-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function FailedList({ items }: { items: FailedSermon[] }) {
  if (items.length === 0) return <p className="mt-3 text-sm text-ink-muted">요약 실패 건이 없습니다.</p>
  return (
    <ul className="mt-3 divide-y divide-line">
      {items.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="min-w-0 truncate text-ink">{sermonListTitle(s)}</span>
          <span className="shrink-0 text-xs text-ink-muted">{s.sermonDate}</span>
          <Link href={`/admin/sermons/${s.id}/edit`} className="shrink-0 text-xs font-semibold text-accent-deep hover:underline">
            재요약
          </Link>
        </li>
      ))}
    </ul>
  )
}

function AlertRow({ label, value, href }: { label: string; value: number; href: string }) {
  const ok = value === 0
  return (
    <Link href={href} className="flex items-center justify-between rounded-lg border border-line bg-paper px-4 py-3 hover:shadow-sm">
      <span className="text-sm text-ink">{label}</span>
      <span className={`text-sm font-bold ${ok ? 'text-ink-muted' : 'text-red-600'}`}>{ok ? '없음' : `${value}건`}</span>
    </Link>
  )
}

export default function DashboardView({ stats }: { stats: AdminDashboardStats }) {
  const { content, summary, failedSermons, alerts } = stats
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-ink">대시보드</h1>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">콘텐츠 현황</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="설교" href="/admin/sermons" pair={content.sermons} />
          <StatCard label="소식·공지" href="/admin/posts" pair={content.posts} />
          <StatCard label="주보" href="/admin/bulletins" pair={content.bulletins} />
          <StatCard label="갤러리" href="/admin/gallery" pair={content.albums} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">
          요약 파이프라인 <span className="font-normal">(자동 요약 대상 {summary.total}편)</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryBadge label="완료(ready)" value={summary.ready} />
          <SummaryBadge label="진행중(pending)" value={summary.pending} />
          <SummaryBadge label="실패(failed)" value={summary.failed} tone="danger" />
          <SummaryBadge label="남은 작업(none+failed)" value={summary.remaining} tone="accent" />
        </div>
        <div className="mt-4 rounded-xl bg-paper p-5 shadow-sm">
          <p className="text-sm font-semibold text-ink">요약 실패 목록</p>
          <FailedList items={failedSermons} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">점검 알림</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <AlertRow label="미분류 설교" value={alerts.uncategorized} href="/admin/sermons" />
          <AlertRow label="설교자 미입력(미공개)" value={alerts.missingPreacher} href="/admin/sermons" />
          <AlertRow label="요약 실패" value={alerts.summaryFailed} href="/admin/sermons" />
        </div>
      </section>
    </div>
  )
}
