import { Suspense } from 'react'
import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import SermonsHero from '@/components/sermons/SermonsHero'
import SermonsGrid from '@/components/sermons/SermonsGrid'
import { getSermons } from '@/lib/data/sermons'

export const metadata: Metadata = {
  title: '예배·설교',
  description: '영천중앙교회 주일예배·수요예배 설교 영상을 말씀 요약과 함께 제공합니다.',
  alternates: {
    canonical: '/sermons',
  },
}

export const revalidate = 3600

export default async function SermonsPage() {
  const sermons = await getSermons()

  return (
    <>
      <SermonsHero />
      <div className="py-20 sm:py-24">
        <Container size="wide">
          <Suspense fallback={null}>
            <SermonsGrid sermons={sermons} />
          </Suspense>
        </Container>
      </div>
    </>
  )
}
