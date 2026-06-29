import Subnav from '@/components/layout/Subnav'

const tabs = [
  { label: '행복선언', href: '/happiness' },
  { label: '주일예배', href: '/worship#sunday' },
  { label: '주일학교', href: '/worship#school' },
  { label: '청년부', href: '/worship#youth' },
  { label: '수요예배', href: '/worship#wednesday' },
  { label: '새벽예배', href: '/worship#dawn' },
  { label: '금요기도회', href: '/worship#friday' },
]

export default function WorshipSubnav() {
  return <Subnav items={tabs} label="예배 안내 하위 메뉴" />
}
