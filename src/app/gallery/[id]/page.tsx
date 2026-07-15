import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Container from '@/components/layout/Container'
import GalleryHero from '@/components/gallery/GalleryHero'
import GalleryGrid from '@/components/gallery/GalleryGrid'
import NewsSubnav from '@/components/news/NewsSubnav'
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
    alternates: {
      canonical: `/gallery/${album.id}`,
    },
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
    <>
      <GalleryHero />
      <NewsSubnav />
      <div className="py-16">
        <Container>
          <time className="text-sm font-semibold text-accent-deep" dateTime={album.eventDate}>
            {album.eventDate}
          </time>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            {album.title}
          </h1>
          {album.description && <p className="mt-5 max-w-3xl leading-8 text-ink-muted">{album.description}</p>}
          <div className="mt-10">
            <GalleryGrid images={album.images} albumTitle={album.title} />
          </div>
        </Container>
      </div>
    </>
  )
}
