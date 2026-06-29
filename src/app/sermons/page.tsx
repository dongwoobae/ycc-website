import { Suspense } from 'react'
import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import PageHero from '@/components/layout/PageHero'
import SermonsGrid from '@/components/sermons/SermonsGrid'
import { getSermons } from '@/lib/data/sermons'

export const metadata: Metadata = {
  title: '예배·설교',
}

export const revalidate = 3600

export default async function SermonsPage() {
  const sermons = await getSermons()

  return (
    <>
      <PageHero
        eyebrow="Sermons"
        title="예배·설교"
        subtitle="주일·찬양·수요 예배의 말씀을 다시 듣고 묵상할 수 있습니다."
        image="https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=80"
      />
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
