import { Suspense } from 'react'
import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import EventsHero from '@/components/news/EventsHero'
import NewsSubnav from '@/components/news/NewsSubnav'
import SermonsGrid from '@/components/sermons/SermonsGrid'
import SermonsGridSkeleton, { SERMONS_PAGE_SIZE } from '@/components/sermons/SermonsGridSkeleton'
import { getSermons } from '@/lib/data/sermons'
import { churchInfo } from '@/lib/church'
import { eventSectionScope } from '@/lib/worship'

export const metadata: Metadata = {
  title: '특별행사',
  description: `${churchInfo.name} 특별행사와 사역 보고 영상을 모아 제공합니다.`,
  alternates: {
    canonical: '/events',
  },
}

export const revalidate = 3600

export default async function EventsPage() {
  const sermons = await getSermons()

  // 골격 카드 수를 실제 첫 페이지와 맞춰야 푸터가 밀리지 않는다.
  const skeletonCount = Math.min(
    sermons.filter((s) => eventSectionScope.includes(s.worshipType)).length,
    SERMONS_PAGE_SIZE,
  )

  return (
    <>
      <EventsHero />
      <NewsSubnav />
      <div className="py-20 sm:py-24">
        <Container size="wide">
          <Suspense fallback={<SermonsGridSkeleton count={skeletonCount} />}>
            <SermonsGrid sermons={sermons} variant="event" />
          </Suspense>
        </Container>
      </div>
    </>
  )
}
