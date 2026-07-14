import Subnav from '@/components/layout/Subnav'

// '말씀과 찬양' 그룹 — 예배·설교(/sermons)와 찬양(/praise)을 잇는 통일 하위 메뉴.
const tabs = [
  { label: '예배·설교', href: '/sermons' },
  { label: '찬양', href: '/praise' },
]

export default function WordSubnav() {
  return <Subnav items={tabs} label="말씀과 찬양 하위 메뉴" />
}
