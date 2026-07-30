import Container from '@/components/layout/Container'
import { Skeleton } from '@/components/ui/Skeleton'

// 히어로와 하위 메뉴는 layout.tsx 가 렌더한다 — 여기서 다시 렌더하면
// fallback → 콘텐츠 교체 때 히어로가 remount 되어 진입 애니메이션이 두 번 재생된다.
export default function Loading() {
  return (
    <div className="py-20 sm:py-24" role="status" aria-label="갤러리를 불러오는 중입니다">
      <Container size="wide">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-line bg-paper shadow-subtle">
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="px-6 pb-6 pt-5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-2 h-6 w-4/5" />
                <Skeleton className="mt-2 h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      </Container>
    </div>
  )
}
