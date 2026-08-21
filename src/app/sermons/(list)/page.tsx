import { Suspense } from 'react'
import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import SermonsGrid from '@/components/sermons/SermonsGrid'
import SermonsGridSkeleton, { SERMONS_PAGE_SIZE } from '@/components/sermons/SermonsGridSkeleton'
import { getSermons } from '@/lib/data/sermons'
import { churchInfo } from '@/lib/church'
import { sermonSectionScope } from '@/lib/worship'

export const metadata: Metadata = {
  title: '예배·설교',
  description: `${churchInfo.name} 주일예배·수요예배 설교 영상을 말씀 요약과 함께 제공합니다.`,
  alternates: {
    canonical: '/sermons',
  },
}

export const revalidate = 3600

export default async function SermonsPage() {
  const sermons = await getSermons()

  // 골격 카드 수를 실제 첫 페이지와 맞춰야 푸터가 밀리지 않는다.
  const skeletonCount = Math.min(sermons.filter((s) => sermonSectionScope.includes(s.worshipType)).length, SERMONS_PAGE_SIZE)

  // 히어로와 하위 메뉴는 (list)/layout.tsx 가 렌더한다
  return (
    <div className="py-20 sm:py-24">
      <Container size="wide">
        <Suspense fallback={<SermonsGridSkeleton count={skeletonCount} />}>
          <SermonsGrid sermons={sermons} />
        </Suspense>
      </Container>
    </div>
  )
}
