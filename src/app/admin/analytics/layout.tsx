import AdminPageHero from '@/components/admin/AdminPageHero'

/**
 * 접속 분석 화면의 고정 히어로.
 *
 * page.tsx 와 loading.tsx 가 각자 렌더하면 스트림 HTML 에 히어로가 두 번 들어가고
 * fallback → 콘텐츠 교체 때 히어로가 remount 된다. layout 에 두면 한 번만 mount 되고
 * 로딩 중에도 자리를 지킨다.
 */
export default function AdminAnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminPageHero
        title="접속 분석"
        subtitle="방문자 수는 일일 순방문자 근사치, 체류시간은 근사값입니다."
        image="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80"
      />
      {children}
    </>
  )
}
