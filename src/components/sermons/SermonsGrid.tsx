'use client'

import { useSearchParams } from 'next/navigation'
import Reveal from '@/components/ui/Reveal'
import SermonCard from '@/components/sermons/SermonCard'
import WorshipFilter from '@/components/sermons/WorshipFilter'
import { isWorshipType, type WorshipFilterValue } from '@/lib/worship'
import type { Sermon } from '@/lib/types'

export default function SermonsGrid({ sermons }: { sermons: Sermon[] }) {
  const searchParams = useSearchParams()
  const worship = searchParams.get('worship')
  const selected = worship && isWorshipType(worship) ? worship : undefined
  const current: WorshipFilterValue = selected ?? '전체'
  const filteredSermons = selected ? sermons.filter((sermon) => sermon.worshipType === selected) : sermons

  return (
    <>
      <div className="mb-9 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-end">
        <WorshipFilter current={current} />
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredSermons.map((sermon, i) => (
          <Reveal key={sermon.id} variant="fade-up" delay={(i % 3) * 90}>
            <SermonCard sermon={sermon} />
          </Reveal>
        ))}
      </div>
    </>
  )
}
