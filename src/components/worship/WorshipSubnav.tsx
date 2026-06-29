import Subnav from '@/components/layout/Subnav'

const tabs = [
  { label: '예배 안내', href: '/worship' },
  { label: '행복선언', href: '/happiness' },
]

export default function WorshipSubnav() {
  return <Subnav items={tabs} label="예배 안내 하위 메뉴" />
}
