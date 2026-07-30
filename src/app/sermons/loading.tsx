import Container from '@/components/layout/Container'
import { Skeleton } from '@/components/ui/Skeleton'

// 히어로는 page.tsx 만 렌더한다 — 여기서 또 렌더하면 fallback → 콘텐츠 교체 때
// 히어로가 unmount 후 다시 mount 되어 Reveal 진입 애니메이션이 두 번 재생된다.
export default function Loading() {
  return (
    <div className="py-20 sm:py-24" role="status" aria-label="설교 목록을 불러오는 중입니다">
      <Container size="wide">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="ml-auto h-10 w-48 rounded-lg" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-line bg-paper shadow-subtle">
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="px-6 pb-6 pt-7">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="mt-3 h-6 w-5/6" />
                <Skeleton className="mt-2 h-6 w-3/5" />
              </div>
            </div>
          ))}
        </div>
      </Container>
    </div>
  )
}
