import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton'

// 히어로는 (list)/layout.tsx 가 렌더한다.
// headings 는 page.tsx 의 실제 표 머리글과 같아야 로딩 → 콘텐츠 전환 때 열이 흔들리지 않는다.
export default function Loading() {
  return (
    <div role="status" aria-label="주보 목록을 불러오는 중입니다">
      <AdminTableSkeleton headings={['날짜', '권/호', '설교 제목', '면', '공개', '관리']} />
    </div>
  )
}
