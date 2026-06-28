import Subnav from '@/components/layout/Subnav'

const tabs = [
  { label: '담임목사 인사', href: '/about/greeting' },
  { label: '교회 연혁', href: '/about/history' },
  { label: '섬기는 사람들', href: '/about/serving' },
]

export default function AboutSubnav() {
  return <Subnav items={tabs} label="교회소개 하위 메뉴" />
}
