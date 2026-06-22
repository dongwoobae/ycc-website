import Subnav from '@/components/layout/Subnav'

const tabs = [
  { label: '소개', href: '/about' },
  { label: '인사말', href: '/about/greeting' },
  { label: '연혁', href: '/about/history' },
  { label: '섬기는 분들', href: '/about/serving' },
  { label: '예배시간·오시는 길', href: '/about/visit' },
]

export default function AboutSubnav() {
  return <Subnav items={tabs} label="교회소개 하위 메뉴" />
}
