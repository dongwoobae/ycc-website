import AdminPageHero from '@/components/admin/AdminPageHero'
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div role="status" aria-label="주보 목록을 불러오는 중입니다">
      <AdminPageHero
        title="주보 관리"
        image="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1600&q=80"
        action={<Skeleton className="h-10 w-20 rounded-lg bg-white/40" />}
      />
      <AdminTableSkeleton headings={['날짜', '권/호', '주제', '공개', '관리']} />
    </div>
  )
}
