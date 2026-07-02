import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-8" role="status" aria-label="대시보드를 불러오는 중입니다">
      <h1 className="text-xl font-bold text-ink">대시보드</h1>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">콘텐츠 현황</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-paper p-5 shadow-sm">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="mt-2 h-9 w-14" />
              <Skeleton className="mt-2 h-3 w-28" />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">요약 파이프라인</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-line bg-paper px-4 py-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-7 w-10" />
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-paper p-5 shadow-sm">
          <p className="text-sm font-semibold text-ink">요약 실패 목록</p>
          <Skeleton className="mt-3 h-4 w-56" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">점검 알림</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-line bg-paper px-4 py-3"
            >
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
