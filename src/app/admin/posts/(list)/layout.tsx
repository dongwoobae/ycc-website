import Link from 'next/link'
import AdminPageHero from '@/components/admin/AdminPageHero'

/**
 * 소식/공지 관리 목록의 고정 히어로.
 *
 * page.tsx 와 loading.tsx 가 각자 렌더하면 스트림 HTML 에 히어로가 두 번 들어가고
 * fallback → 콘텐츠 교체 때 히어로가 remount 된다. layout 에 두면 한 번만 mount 되고
 * 로딩 중에도 자리를 지킨다.
 *
 * (list) 라우트 그룹에 두는 이유: 등록·수정 화면(new, [id]/edit)은 자체 컴팩트 헤더를 쓴다.
 * 세그먼트 전체 layout 으로 올리면 그 화면에도 큰 히어로가 붙는다.
 * 라우트 그룹은 URL 에 나타나지 않으므로 /admin/posts 경로는 그대로다.
 */
export default function AdminPostsListLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminPageHero
        title="소식/공지 관리"
        image="https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1600&q=80"
      />
      {/* 등록 버튼은 히어로 아래 좌측 — 설교 관리의 "지금 동기화"와 같은 위치 */}
      <div className="mb-4">
        <Link
          href="/admin/posts/new"
          className="inline-block rounded-md bg-accent-deep px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          새 게시글
        </Link>
      </div>
      {children}
    </>
  )
}
