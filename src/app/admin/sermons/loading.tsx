import AdminPageHero from '@/components/admin/AdminPageHero'
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div role="status" aria-label="설교 목록을 불러오는 중입니다">
      <AdminPageHero
        title="설교 관리"
        image="https://images.unsplash.com/photo-1473773508845-188df298d2d1?auto=format&fit=crop&w=1600&q=80"
      />
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-48 rounded-md" />
      </div>
      <Skeleton className="mb-4 h-4 w-full max-w-2xl" />
      <AdminTableSkeleton
        headings={['Date', 'Title', 'Preacher', 'Worship', 'Thumbnail', 'Summary', 'Published', 'Actions']}
        minWidthClass="min-w-[44rem]"
      />
    </div>
  )
}
