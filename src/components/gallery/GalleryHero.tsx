import PageHero from '@/components/layout/PageHero'

/** 갤러리 목록·상세 공통 히어로. 두 페이지가 동일하게 보이도록 한 곳에서 관리한다. */
export default function GalleryHero() {
  return (
    <PageHero
      eyebrow="Gallery"
      title="갤러리"
      subtitle="교회 공동체의 예배와 섬김, 교제의 순간을 앨범으로 모았습니다."
    />
  )
}
