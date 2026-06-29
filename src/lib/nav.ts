// 사이트 전역 네비게이션 단일 출처.
// Header(데스크탑 메가 + 모바일 메뉴)와 섹션 서브내비가 공유한다.

export interface NavChild {
  label: string
  href: string
  desc: string
}

export interface NavSection {
  label: string
  href: string
  section: string
  eyebrow: string
  children: NavChild[]
}

const aboutLinks: NavChild[] = [
  { label: '교회 연혁', href: '/about/history', desc: '걸어온 발자취' },
  { label: '담임목사 인사', href: '/about/greeting', desc: '담임목사 인사말' },
  { label: '섬기는 사람들', href: '/about/serving', desc: '함께 섬기는 이들' },
]

const guideLinks: NavChild[] = [
  { label: '예배 안내', href: '/worship', desc: '예배 시간과 위치 안내' },
  { label: '행복선언', href: '/happiness', desc: '예배 때 함께하는 고백' },
]

const wordLinks: NavChild[] = [
  { label: '주일설교', href: '/sermons?worship=주일예배', desc: '주일예배 말씀' },
  { label: '찬양예배 설교', href: '/sermons?worship=주일찬양예배', desc: '찬양예배 말씀' },
  { label: '수요설교', href: '/sermons?worship=수요예배', desc: '수요예배 말씀' },
  { label: '시온찬양대', href: '/sermons?worship=시온찬양대', desc: '찬양대 영상' },
]

const newcomerLinks: NavChild[] = [
  { label: '예배 시간표', href: '/worship#sunday', desc: '예배 안내' },
  { label: '교회 지도', href: '/about/visit#map', desc: '오시는 길' },
  { label: '주소 · 연락처', href: '/about/visit#contact', desc: '위치와 전화' },
  { label: 'FAQ', href: '/faq', desc: '자주 묻는 질문' },
]

const newsLinks: NavChild[] = [
  { label: '교회소식', href: '/news', desc: '교회 소식과 공지' },
  { label: '행사 사진', href: '/gallery', desc: '사진으로 보는 일상' },
]

export const navLinks: NavSection[] = [
  { label: '소개', href: '/about', section: '/about', eyebrow: 'About', children: aboutLinks },
  { label: '안내', href: '/worship', section: '/worship', eyebrow: 'Guide', children: guideLinks },
  { label: '말씀과 찬양', href: '/sermons', section: '/sermons', eyebrow: 'Worship', children: wordLinks },
  { label: '처음 오셨나요?', href: '/newfamily', section: '/newfamily', eyebrow: 'Welcome', children: newcomerLinks },
  { label: '소식', href: '/news', section: '/news', eyebrow: 'News', children: newsLinks },
]
