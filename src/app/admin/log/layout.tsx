import AdminPageHero from '@/components/admin/AdminPageHero'

/**
 * 서버 로그 화면의 고정 히어로.
 *
 * page.tsx 와 loading.tsx 가 각자 렌더하면 스트림 HTML 에 히어로가 두 번 들어가고
 * fallback → 콘텐츠 교체 때 히어로가 remount 된다. layout 에 두면 한 번만 mount 되고
 * 로딩 중에도 자리를 지킨다.
 */
export default function AdminLogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminPageHero
        title="서버 로그"
        image="https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1600&q=80"
      />
      {children}
    </>
  )
}
