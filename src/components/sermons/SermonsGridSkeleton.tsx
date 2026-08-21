import { Skeleton } from '@/components/ui/Skeleton'

export const SERMONS_PAGE_SIZE = 12

/**
 * 그리드가 차지할 자리를 미리 잡는 골격.
 *
 * SermonsGrid 는 useSearchParams 를 쓰기 때문에 프리렌더에서 가장 가까운 Suspense
 * 경계까지가 클라이언트 렌더로 넘어간다. 그 자리를 비워 두면 하이드레이션 뒤
 * 그리드가 통째로 들어오면서 아래 있는 푸터가 그만큼 밀린다 — 측정된 CLS 0.312 다.
 *
 * 그래서 카드 수를 실제 첫 페이지와 맞춰야 의미가 있다. 호출부가 스코프로 거른
 * 개수를 넘긴다.
 */
export default function SermonsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="ml-auto h-10 w-48 rounded-lg" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
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
    </>
  )
}
