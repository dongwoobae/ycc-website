import AdminPageHero from '@/components/admin/AdminPageHero'

/**
 * 설교 관리 목록의 고정 히어로.
 *
 * page.tsx 와 loading.tsx 가 각자 렌더하면 스트림 HTML 에 히어로가 두 번 들어가고
 * fallback → 콘텐츠 교체 때 히어로가 remount 된다. layout 에 두면 한 번만 mount 되고
 * 로딩 중에도 자리를 지킨다.
 *
 * (list) 라우트 그룹에 두는 이유: 수정 화면([id]/edit)은 자체 컴팩트 헤더를 쓴다.
 * 세그먼트 전체 layout 으로 올리면 그 화면에도 큰 히어로가 붙는다.
 * 라우트 그룹은 URL 에 나타나지 않으므로 /admin/sermons 경로는 그대로다.
 */
export default function AdminSermonsListLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminPageHero
        title="설교 관리"
        image="https://images.unsplash.com/photo-1473773508845-188df298d2d1?auto=format&fit=crop&w=1600&q=80"
      />
      {children}
    </>
  )
}
