import Container from '@/components/layout/Container'
import SermonsHero from '@/components/sermons/SermonsHero'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <>
      <SermonsHero />
      <div className="py-20 sm:py-24" role="status" aria-label="설교 목록을 불러오는 중입니다">
        <Container size="wide">
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="ml-auto h-10 w-48 rounded-lg" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-line bg-paper shadow-subtle">
                <Skeleton className="aspect-video w-full rounded-none" />
                <div className="px-6 pb-6 pt-7">
                  <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="mt-3 h-6 w-5/6" />
                  <Skeleton className="mt-2 h-6 w-3/5" />
                </div>
              </div>
            ))}
          </div>
        </Container>
      </div>
    </>
  )
}
