import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton'

// 히어로는 (list)/layout.tsx 가 렌더한다.
export default function Loading() {
  return (
    <div role="status" aria-label="게시글 목록을 불러오는 중입니다">
      <AdminTableSkeleton
        headings={['날짜', '제목', '카테고리', '고정', '공개', '관리']}
        minWidthClass="min-w-[52rem]"
      />
    </div>
  )
}
