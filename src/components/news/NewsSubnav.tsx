import Subnav from '@/components/layout/Subnav'

const tabs = [
  { label: '소식', href: '/news' },
  { label: '주보', href: '/bulletins' },
  { label: '갤러리', href: '/gallery' },
  { label: '특별행사', href: '/events' },
]

export default function NewsSubnav() {
  return <Subnav items={tabs} label="교회소식 하위 메뉴" />
}
