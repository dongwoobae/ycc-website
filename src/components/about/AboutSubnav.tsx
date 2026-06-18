'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Container from '@/components/layout/Container'

const tabs = [
  { label: '소개', href: '/about' },
  { label: '연혁', href: '/about/history' },
  { label: '섬기는 분들', href: '/about/serving' },
  { label: '예배시간·오시는 길', href: '/about/visit' },
]

export default function AboutSubnav() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-20 z-40 border-b border-line bg-paper" aria-label="교회소개 하위 메뉴">
      <Container size="wide" className="flex gap-1.5 overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.href === '/about' ? pathname === '/about' : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`flex-none whitespace-nowrap border-b-2 px-4 py-[18px] text-[15px] font-bold transition ${
                active
                  ? 'border-accent text-accent-deep'
                  : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </Container>
    </nav>
  )
}
