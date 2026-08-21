import Container from '@/components/layout/Container'
import SermonsGridSkeleton from '@/components/sermons/SermonsGridSkeleton'

// 히어로와 하위 메뉴는 (list)/layout.tsx 가 렌더한다.
// 여기서 또 렌더하면 fallback → 콘텐츠 교체 때 중복되며 Reveal 진입 애니메이션도 다시 재생된다.
export default function Loading() {
  return (
    <div className="py-20 sm:py-24" role="status" aria-label="설교 목록을 불러오는 중입니다">
      <Container size="wide">
        <SermonsGridSkeleton />
      </Container>
    </div>
  )
}
