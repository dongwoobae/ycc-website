import Container from '@/components/layout/Container'
import GalleryHero from '@/components/gallery/GalleryHero'
import NewsSubnav from '@/components/news/NewsSubnav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <>
      <GalleryHero />
      <NewsSubnav />
      <div className="py-20 sm:py-24" role="status" aria-label="갤러리를 불러오는 중입니다">
        <Container size="wide">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-line bg-paper shadow-subtle">
                <Skeleton className="aspect-[4/3] w-full rounded-none" />
                <div className="px-6 pb-6 pt-5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="mt-2 h-6 w-4/5" />
                  <Skeleton className="mt-2 h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        </Container>
      </div>
    </>
  )
}
