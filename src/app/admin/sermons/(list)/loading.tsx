import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div role="status" aria-label="설교 목록을 불러오는 중입니다">
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
