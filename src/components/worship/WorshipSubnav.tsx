import Subnav from '@/components/layout/Subnav'

const tabs = [
  { label: '행복선언', href: '/happiness' },
  { label: '예배 시간', href: '/worship' },
]

export default function WorshipSubnav() {
  return <Subnav items={tabs} label="안내 하위 메뉴" />
}
