import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'
import AlbumCard from '@/components/gallery/AlbumCard'
import { getGalleryAlbums } from '@/lib/data/gallery'
import { churchInfo } from '@/lib/church'

export const metadata: Metadata = {
  title: '갤러리',
  description: `${churchInfo.name}의 예배와 행사, 공동체 활동 사진을 모았습니다.`,
  alternates: {
    canonical: '/gallery',
  },
}

export const revalidate = 3600

export default async function GalleryPage() {
  const albums = await getGalleryAlbums()

  // 히어로와 하위 메뉴는 src/app/gallery/layout.tsx 가 렌더한다
  return (
    <>
      <div className="py-20 sm:py-24">
        <Container size="wide">
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
