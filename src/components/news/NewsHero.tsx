import PageHero from '@/components/layout/PageHero'

/** 교회소식 목록·상세 공통 히어로. 두 페이지가 동일하게 보이도록 한 곳에서 관리한다. */
export default function NewsHero() {
  return (
    <PageHero
      tone="news"
      eyebrow="News"
      title="교회소식"
      subtitle="공지와 행사, 공동체 소식을 전합니다."
    />
  )
}
