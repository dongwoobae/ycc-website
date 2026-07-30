import NewsHero from '@/components/news/NewsHero'
import NewsSubnav from '@/components/news/NewsSubnav'

/**
 * 소식 섹션의 고정 크롬(히어로 + 하위 메뉴).
 *
 * page.tsx 와 loading.tsx 가 각자 렌더하면 fallback → 콘텐츠 교체 때 히어로가
 * unmount 후 다시 mount 되어 Reveal 진입 애니메이션이 두 번 재생된다.
 * layout 에 두면 한 번만 mount 되고 로딩 중에도 자리를 지킨다.
 */
export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NewsHero />
      <NewsSubnav />
      {children}
    </>
  )
}
