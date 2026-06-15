import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Container from '@/components/layout/Container'
import { getGalleryAlbumById } from '@/lib/seed/gallery'

interface GalleryDetailProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: GalleryDetailProps): Promise<Metadata> {
  const { id } = await params
  const album = await getGalleryAlbumById(id)
  if (!album) return { title: '갤러리' }
  return {
    title: album.title,
    description: album.description,
    openGraph: {
      title: album.title,
      images: [album.coverImgUrl],
    },
  }
}

export default async function GalleryDetailPage({ params }: GalleryDetailProps) {
  const { id } = await params
  const album = await getGalleryAlbumById(id)
  if (!album) notFound()

  return (
    <div className="py-16">
      <Container>
        <time className="text-sm font-semibold text-accent" dateTime={album.eventDate}>
          {album.eventDate}
        </time>
        <h1 className="mt-3 font-serif text-4xl text-ink sm:text-5xl">{album.title}</h1>
        {album.description && <p className="mt-5 max-w-3xl leading-8 text-ink-muted">{album.description}</p>}
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {album.images.map((image) => (
            <figure key={image.id} className="overflow-hidden rounded-lg border border-line bg-paper shadow-subtle">
              <div className="aspect-[4/3] bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.imageUrl} alt={image.alt} className="h-full w-full object-cover" />
              </div>
              {image.caption && <figcaption className="p-4 text-sm text-ink-muted">{image.caption}</figcaption>}
            </figure>
          ))}
        </div>
      </Container>
    </div>
  )
}
