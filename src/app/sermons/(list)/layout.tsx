import SermonsHero from '@/components/sermons/SermonsHero'
import WordSubnav from '@/components/sermons/WordSubnav'

/**
 * 설교 목록의 고정 크롬(히어로 + 하위 메뉴).
 *
 * page.tsx 와 loading.tsx 가 각자 렌더하면 fallback → 콘텐츠 교체 때 히어로가
 * unmount 후 다시 mount 되어 Reveal 진입 애니메이션이 두 번 재생된다.
 * layout 에 두면 한 번만 mount 되고 로딩 중에도 자리를 지킨다.
 *
 * (list) 라우트 그룹에 두는 이유: 설교 상세(/sermons/[id])에는 히어로가 없다.
 * 세그먼트 전체 layout 으로 올리면 상세 화면에도 히어로가 붙는다.
 * 라우트 그룹은 URL 에 나타나지 않으므로 /sermons 경로는 그대로다.
 */
export default function SermonsListLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SermonsHero />
      <WordSubnav />
      {children}
    </>
  )
}
