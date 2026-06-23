import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Container from '@/components/layout/Container'
import SermonSummary from '@/components/sermons/SermonSummary'
import { getSermonById, getSermons } from '@/lib/data/sermons'

export const revalidate = 3600

interface SermonDetailProps {
  params: Promise<{ id: string }>
}

export async function generateStaticParams() {
  const sermons = await getSermons()
  return sermons.map((sermon) => ({ id: sermon.id }))
}

export async function generateMetadata({ params }: SermonDetailProps): Promise<Metadata> {
  const { id } = await params
  const sermon = await getSermonById(id)
  if (!sermon) return { title: '설교' }
  return {
    title: sermon.title,
    description: `${sermon.preacher} · ${sermon.scripture ?? sermon.worshipType}`,
    openGraph: {
      title: sermon.title,
      description: sermon.summary,
      images: sermon.thumbnailUrl ? [sermon.thumbnailUrl] : undefined,
    },
  }
}

export default async function SermonDetailPage({ params }: SermonDetailProps) {
  const { id } = await params
  const sermon = await getSermonById(id)
  if (!sermon) notFound()

  return (
    <div className="py-16">
      <Container className="max-w-4xl">
        {sermon.worshipType !== '미분류' ? (
          <p className="text-sm font-semibold text-accent-deep">{sermon.worshipType}</p>
        ) : null}
        <h1 className="mt-3 font-serif text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
          {sermon.title}
        </h1>
        <p className="mt-4 text-ink-muted">
          {sermon.preacher} · {sermon.scripture} · {sermon.sermonDate}
        </p>
        <SermonSummary sermon={sermon} />
      </Container>
    </div>
  )
}
