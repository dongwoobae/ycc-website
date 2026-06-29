import PageHero from '@/components/layout/PageHero'

/** 교회소식 목록·상세 공통 히어로. 두 페이지가 동일하게 보이도록 한 곳에서 관리한다. */
export default function NewsHero() {
  return (
    <PageHero
      eyebrow="News"
      title="교회소식"
      subtitle="공지와 행사, 공동체 소식을 전합니다."
      image="https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1600&q=80"
    />
  )
}
