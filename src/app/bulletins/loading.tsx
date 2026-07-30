import Container from '@/components/layout/Container'
import { Skeleton } from '@/components/ui/Skeleton'

// 히어로와 하위 메뉴는 page.tsx 만 렌더한다 — 여기서 또 렌더하면 fallback → 콘텐츠 교체 때
// 히어로가 unmount 후 다시 mount 되어 Reveal 진입 애니메이션이 두 번 재생된다.
//
// 형태는 page.tsx 와 맞춘다: 최신 주보 피처드 카드(표지 + 설교 제목) + 지난 주보 날짜 목록.
export default function Loading() {
  return (
    <div className="py-16 sm:py-20" role="status" aria-label="주보 목록을 불러오는 중입니다">
      <Container size="wide">
        <div className="grid gap-5 rounded-2xl border border-line bg-paper p-6 shadow-subtle sm:grid-cols-[140px_1fr] sm:p-8">
          <Skeleton className="aspect-[1/1.414] w-full rounded-lg" />
          <div>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-9 w-4/5" />
            <Skeleton className="mt-3 h-4 w-2/3" />
            <Skeleton className="mt-5 h-4 w-24" />
          </div>
        </div>

        <div className="mt-10">
          <Skeleton className="h-3 w-16" />
          <div className="mt-3 divide-y divide-line-soft border-t border-line">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-baseline justify-between gap-4 py-3.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        </div>
      </Container>
    </div>
  )
}
