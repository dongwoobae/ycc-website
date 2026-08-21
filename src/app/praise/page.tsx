import { Suspense } from 'react'
import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import PraiseHero from '@/components/praise/PraiseHero'
import WordSubnav from '@/components/sermons/WordSubnav'
import SermonsGrid from '@/components/sermons/SermonsGrid'
import SermonsGridSkeleton, { SERMONS_PAGE_SIZE } from '@/components/sermons/SermonsGridSkeleton'
import { getSermons } from '@/lib/data/sermons'
import { churchInfo } from '@/lib/church'
import { praiseSectionScope } from '@/lib/worship'

export const metadata: Metadata = {
  title: '찬양',
  description: `${churchInfo.name} 찬양대·특송 찬양 영상을 모아 제공합니다.`,
  alternates: {
    canonical: '/praise',
  },
}

export const revalidate = 3600

export default async function PraisePage() {
  const sermons = await getSermons()

  // 골격 카드 수를 실제 첫 페이지와 맞춰야 푸터가 밀리지 않는다.
  const skeletonCount = Math.min(
    sermons.filter((s) => praiseSectionScope.includes(s.worshipType)).length,
    SERMONS_PAGE_SIZE,
  )

  return (
    <>
      <PraiseHero />
      <WordSubnav />
      <div className="py-20 sm:py-24">
        <Container size="wide">
          <Suspense fallback={<SermonsGridSkeleton count={skeletonCount} />}>
            <SermonsGrid sermons={sermons} variant="praise" />
          </Suspense>
        </Container>
      </div>
    </>
  )
}
