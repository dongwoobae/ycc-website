import { Suspense } from 'react'
import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import PraiseHero from '@/components/praise/PraiseHero'
import SermonsGrid from '@/components/sermons/SermonsGrid'
import { getSermons } from '@/lib/data/sermons'

export const metadata: Metadata = {
  title: '찬양',
  description: '영천중앙교회 찬양대·특송 찬양 영상을 모아 제공합니다.',
  alternates: {
    canonical: '/praise',
  },
}

export const revalidate = 3600

export default async function PraisePage() {
  const sermons = await getSermons()

  return (
    <>
      <PraiseHero />
      <div className="py-20 sm:py-24">
        <Container size="wide">
          <Suspense fallback={null}>
            <SermonsGrid sermons={sermons} variant="praise" />
          </Suspense>
        </Container>
      </div>
    </>
  )
}
