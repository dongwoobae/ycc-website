import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import SectionTitle from '@/components/ui/SectionTitle'
import AlbumCard from '@/components/gallery/AlbumCard'
import { getGalleryAlbums } from '@/lib/seed/gallery'

export const metadata: Metadata = {
  title: '갤러리',
}

export default async function GalleryPage() {
  const albums = await getGalleryAlbums()

  return (
    <div className="py-16">
      <Container>
        <SectionTitle eyebrow="Gallery" title="갤러리" description="교회 공동체의 예배와 섬김, 교제의 순간을 앨범으로 모았습니다." />
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </div>
      </Container>
    </div>
  )
}
