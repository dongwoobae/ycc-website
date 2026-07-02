import AdminPageHero from '@/components/admin/AdminPageHero'
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div role="status" aria-label="접속 분석을 불러오는 중입니다">
      <AdminPageHero
        title="접속 분석"
        subtitle="방문자 수는 일일 순방문자 근사치, 체류시간은 근사값입니다."
        image="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80"
      />

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {['오늘', '최근 7일', '최근 30일'].map((label) => (
          <section key={label} className="rounded-xl bg-paper p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-ink-muted">{label}</h2>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="mt-2 h-6 w-16" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-16 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>

      <section className="mb-6 rounded-xl bg-paper p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-ink">일별 추이</h2>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </section>

      <AdminTableSkeleton
        headings={['시작시각', '지역', 'IP', '페이지수', '총 체류']}
        minWidthClass="min-w-[56rem]"
      />
    </div>
  )
}
