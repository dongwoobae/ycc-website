import Container from '@/components/layout/Container'
import { Skeleton } from '@/components/ui/Skeleton'

// 히어로와 하위 메뉴는 layout.tsx 가 렌더한다 — 여기서 다시 렌더하면
// fallback → 콘텐츠 교체 때 히어로가 remount 되어 진입 애니메이션이 두 번 재생된다.
export default function Loading() {
  return (
    <div className="py-20 sm:py-24" role="status" aria-label="교회소식을 불러오는 중입니다">
      <Container className="max-w-3xl">
        <div className="space-y-4 rounded-2xl border border-line bg-paper p-8 shadow-subtle sm:p-11">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              {i > 0 && <hr className="mb-4 border-line" />}
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-6 w-3/4" />
              <Skeleton className="mt-2 h-4 w-full" />
            </div>
          ))}
        </div>
      </Container>
    </div>
  )
}
