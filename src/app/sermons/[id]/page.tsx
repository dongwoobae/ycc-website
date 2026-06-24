import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Container from '@/components/layout/Container'
import SermonSummary from '@/components/sermons/SermonSummary'
import { getSermonById, getSermons } from '@/lib/data/sermons'
import { sermonListTitle } from '@/lib/sermons/list-title'

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
  const displayTitle = sermonListTitle(sermon)
  return {
    title: displayTitle,
    description: sermon.summary ?? `${sermon.preacher} · ${sermon.worshipType}`,
    openGraph: {
      title: displayTitle,
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
      <Container className="max-w-[1600px]">
        <SermonSummary sermon={sermon} />
      </Container>
    </div>
  )
}
