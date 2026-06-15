import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import SectionTitle from '@/components/ui/SectionTitle'
import SermonCard from '@/components/sermons/SermonCard'
import WorshipFilter from '@/components/sermons/WorshipFilter'
import { getSermonsByWorshipType } from '@/lib/seed/sermons'
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
    <div className="py-16">
      <Container>
        <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionTitle eyebrow="Sermons" title="예배·설교" description="예배별 말씀을 다시 듣고 묵상할 수 있습니다." />
          <WorshipFilter current={current} />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sermons.map((sermon) => (
            <SermonCard key={sermon.id} sermon={sermon} />
          ))}
        </div>
      </Container>
    </div>
  )
}
