// 사이트 전역 네비게이션 단일 출처.
// Header(데스크탑 메가 + 모바일 메뉴)와 섹션 서브내비가 공유한다.

export interface NavChild {
  label: string
  href: string
  desc: string
}

// 한 상위 메뉴 안의 하위 그룹(예: '말씀과 찬양' → 예배·설교 / 찬양).
export interface NavGroup {
  label: string
  href: string
  children: NavChild[]
}

export interface NavSection {
  label: string
  href: string
  section: string
  eyebrow: string
  children: NavChild[]
  /** 하위 그룹으로 나뉘는 섹션이면 사용. 없으면 children을 평면으로 노출. */
  groups?: NavGroup[]
}

const aboutLinks: NavChild[] = [
  { label: '교회 연혁', href: '/about/history', desc: '걸어온 발자취' },
  { label: '담임목사 인사', href: '/about/greeting', desc: '담임목사 인사말' },
  { label: '섬기는 사람들', href: '/about/serving', desc: '함께 섬기는 이들' },
]

const guideLinks: NavChild[] = [
  { label: '행복선언', href: '/happiness', desc: '예배 때 함께하는 고백' },
  { label: '예배 시간', href: '/worship', desc: '요일·시간·장소 안내' },
]

const sermonGroupLinks: NavChild[] = [
  { label: '주일설교', href: '/sermons?worship=주일예배', desc: '주일예배 말씀' },
  { label: '찬양예배 설교', href: '/sermons?worship=주일찬양예배', desc: '찬양예배 말씀' },
  { label: '수요설교', href: '/sermons?worship=수요예배', desc: '수요예배 말씀' },
]

const praiseGroupLinks: NavChild[] = [
  { label: '찬양대', href: '/praise?worship=시온찬양대', desc: '찬양대 영상' },
  { label: '특송', href: '/praise?worship=특송', desc: '특송 영상' },
]

// '말씀과 찬양' 하위 그룹: 예배·설교(/sermons)와 찬양(/praise).
const worshipGroups: NavGroup[] = [
  { label: '예배·설교', href: '/sermons', children: sermonGroupLinks },
  { label: '찬양', href: '/praise', children: praiseGroupLinks },
]

// 모바일 아코디언 등 평면 목록이 필요한 곳을 위한 폴백.
const wordLinks: NavChild[] = [...sermonGroupLinks, ...praiseGroupLinks]

const newcomerLinks: NavChild[] = [
  { label: '예배 안내', href: '/newfamily#flow', desc: '예배 시간과 진행 순서' },
  { label: '자주 묻는 질문', href: '/newfamily#faq', desc: '새가족 FAQ' },
  { label: '다음세대 안내', href: '/newfamily#nextgen', desc: '아이와 함께 오세요' },
  { label: '오시는 길', href: '/newfamily#visit', desc: '지도 · 주소 · 연락처' },
]

const newsLinks: NavChild[] = [
  { label: '교회소식', href: '/news', desc: '교회 소식과 공지' },
  { label: '주보', href: '/bulletins', desc: '주간 주보 열람' },
  { label: '행사 사진', href: '/gallery', desc: '사진으로 보는 일상' },
  { label: '특별행사', href: '/sermons?worship=특별행사', desc: '특별행사 영상' },
  { label: '기타', href: '/sermons?worship=기타', desc: '기타 영상' },
]

export const navLinks: NavSection[] = [
  { label: '소개', href: '/about', section: '/about', eyebrow: 'About', children: aboutLinks },
  { label: '안내', href: '/happiness', section: '/happiness', eyebrow: 'Guide', children: guideLinks },
  { label: '말씀과 찬양', href: '/sermons', section: '/sermons', eyebrow: 'Worship', children: wordLinks, groups: worshipGroups },
  { label: '처음 오셨나요?', href: '/newfamily', section: '/newfamily', eyebrow: 'Welcome', children: newcomerLinks },
  { label: '소식', href: '/news', section: '/news', eyebrow: 'News', children: newsLinks },
]
