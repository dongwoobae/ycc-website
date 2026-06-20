import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Container from '@/components/layout/Container'
import YouTubeEmbed from '@/components/sermons/YouTubeEmbed'
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
        <p className="text-sm font-semibold text-accent-deep">{sermon.worshipType}</p>
        <h1 className="mt-3 font-serif text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
          {sermon.title}
        </h1>
        <p className="mt-4 text-ink-muted">
          {sermon.preacher} · {sermon.scripture} · {sermon.sermonDate}
        </p>
        <div className="mt-8">
          <YouTubeEmbed youtubeId={sermon.youtubeId} title={sermon.title} />
        </div>
        {sermon.summary && (
          <section className="mt-8 rounded-lg border border-line bg-paper p-6 shadow-subtle">
            <h2 className="font-serif text-2xl font-extrabold tracking-tight text-ink">설교 요약</h2>
            <p className="mt-4 leading-8 text-ink-muted">{sermon.summary}</p>
          </section>
        )}
      </Container>
    </div>
  )
}
