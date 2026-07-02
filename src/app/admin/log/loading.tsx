import AdminPageHero from '@/components/admin/AdminPageHero'
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div role="status" aria-label="서버 로그를 불러오는 중입니다">
      <AdminPageHero
        title="서버 로그"
        image="https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1600&q=80"
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
        <span className="text-ink-muted">~</span>
        <Skeleton className="h-9 w-36 rounded-lg" />
        <Skeleton className="h-9 w-16 rounded-lg" />
      </div>
      <AdminTableSkeleton
        headings={['시간', '액션', '대상', 'ID', '메시지', '사용자']}
        rows={10}
      />
    </div>
  )
}
