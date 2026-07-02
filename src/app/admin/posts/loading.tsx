import AdminPageHero from '@/components/admin/AdminPageHero'
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div role="status" aria-label="게시글 목록을 불러오는 중입니다">
      <AdminPageHero
        title="소식/공지 관리"
        image="https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1600&q=80"
        action={<Skeleton className="h-10 w-24 rounded-lg bg-white/40" />}
      />
      <AdminTableSkeleton
        headings={['날짜', '제목', '카테고리', '고정', '공개', '관리']}
        minWidthClass="min-w-[52rem]"
      />
    </div>
  )
}
