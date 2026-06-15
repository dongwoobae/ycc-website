import Link from 'next/link'
import Container from '@/components/layout/Container'
import SectionTitle from '@/components/ui/SectionTitle'
import Reveal from '@/components/ui/Reveal'
import type { Sermon } from '@/lib/types'
import SermonPlayCard from './SermonPlayCard'

export default function RecentSermons({ sermons }: { sermons: Sermon[] }) {
  if (sermons.length === 0) return null

  return (
    <section id="sermons" className="bg-surface py-24 min-[960px]:py-32">
      <Container size="wide">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <SectionTitle eyebrow="Messages" title="최근 설교" />
            <Link
              href="/sermons"
              className="motion-hover rounded-full border border-line bg-paper px-5 py-3 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:border-accent"
            >
              전체 설교 보기 →
            </Link>
          </div>
        </Reveal>
        <div className="mt-12 grid gap-6 min-[560px]:grid-cols-2 min-[960px]:grid-cols-3">
          {sermons.map((sermon, index) => (
            <Reveal key={sermon.id} delay={index * 90}>
              <SermonPlayCard sermon={sermon} />
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}
