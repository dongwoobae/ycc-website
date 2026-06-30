import Container from '@/components/layout/Container'
import BulletinsHero from '@/components/bulletins/BulletinsHero'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <>
      <BulletinsHero />
      <div className="py-20 sm:py-24" role="status" aria-label="주보 목록을 불러오는 중입니다">
        <Container size="wide">
          <div className="grid gap-6 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-line bg-paper p-8 shadow-subtle">
                <Skeleton className="h-[42px] w-[42px] rounded-xl" />
                <Skeleton className="mt-[18px] h-4 w-24" />
                <Skeleton className="mt-3 h-8 w-2/3" />
                <Skeleton className="mt-4 h-5 w-1/2" />
                <Skeleton className="mt-2 h-4 w-1/3" />
                <Skeleton className="mt-5 h-4 w-24" />
              </div>
            ))}
          </div>
        </Container>
      </div>
    </>
  )
}
