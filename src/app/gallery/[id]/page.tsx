import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import Container from '@/components/layout/Container'
import { getGalleryAlbumById, getGalleryAlbums } from '@/lib/data/gallery'

export const revalidate = 3600

interface GalleryDetailProps {
  params: Promise<{ id: string }>
}

export async function generateStaticParams() {
  const albums = await getGalleryAlbums()
  return albums.map((album) => ({ id: album.id }))
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
        <time className="text-sm font-semibold text-accent-deep" dateTime={album.eventDate}>
          {album.eventDate}
        </time>
        <h1 className="mt-3 font-serif text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          {album.title}
        </h1>
        {album.description && <p className="mt-5 max-w-3xl leading-8 text-ink-muted">{album.description}</p>}
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {album.images.map((image) => (
            <figure key={image.id} className="overflow-hidden rounded-lg border border-line bg-paper shadow-subtle">
              <div className="relative aspect-[4/3] bg-surface">
                <Image
                  src={image.imageUrl}
                  alt={image.alt}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              {image.caption && <figcaption className="p-4 text-sm text-ink-muted">{image.caption}</figcaption>}
            </figure>
          ))}
        </div>
      </Container>
    </div>
  )
}
