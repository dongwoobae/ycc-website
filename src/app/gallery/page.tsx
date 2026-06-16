import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import PageHero from '@/components/layout/PageHero'
import Reveal from '@/components/ui/Reveal'
import AlbumCard from '@/components/gallery/AlbumCard'
import { getGalleryAlbums } from '@/lib/data/gallery'

export const metadata: Metadata = {
  title: '갤러리',
}

export default async function GalleryPage() {
  const albums = await getGalleryAlbums()

  return (
    <>
      <PageHero
        eyebrow="Gallery"
        title="갤러리"
        subtitle="교회 공동체의 예배와 섬김, 교제의 순간을 앨범으로 모았습니다."
        image="https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1600&q=80"
      />
      <div className="py-16">
        <Container>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {albums.map((album, i) => (
              <Reveal key={album.id} variant="zoom" delay={(i % 3) * 90}>
                <AlbumCard album={album} />
              </Reveal>
            ))}
          </div>
        </Container>
      </div>
    </>
  )
}
