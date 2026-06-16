import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import PageHero from '@/components/layout/PageHero'
import Reveal from '@/components/ui/Reveal'
import SermonCard from '@/components/sermons/SermonCard'
import WorshipFilter from '@/components/sermons/WorshipFilter'
import { getSermonsByWorshipType } from '@/lib/data/sermons'
import { isWorshipType, type WorshipFilterValue } from '@/lib/worship'

export const metadata: Metadata = {
  title: '예배·설교',
}

interface SermonsPageProps {
  searchParams: Promise<{ worship?: string }>
}

export default async function SermonsPage({ searchParams }: SermonsPageProps) {
  const { worship } = await searchParams
  const selected = worship && isWorshipType(worship) ? worship : undefined
  const sermons = await getSermonsByWorshipType(selected)
  const current: WorshipFilterValue = selected ?? '전체'

  return (
    <>
      <PageHero
        eyebrow="Sermons"
        title="예배·설교"
        subtitle="주일·찬양·수요 예배의 말씀을 다시 듣고 묵상할 수 있습니다."
        image="https://images.unsplash.com/photo-1473773508845-188df298d2d1?auto=format&fit=crop&w=1600&q=80"
      />
      <div className="py-16">
        <Container>
          <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-end">
            <WorshipFilter current={current} />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sermons.map((sermon, i) => (
              <Reveal key={sermon.id} variant="fade-up" delay={(i % 3) * 90}>
                <SermonCard sermon={sermon} />
              </Reveal>
            ))}
          </div>
        </Container>
      </div>
    </>
  )
}
