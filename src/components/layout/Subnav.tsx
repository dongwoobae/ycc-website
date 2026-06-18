'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Container from './Container'

export interface SubnavItem {
  label: string
  href: string
}

export default function Subnav({ items, label }: { items: SubnavItem[]; label: string }) {
  const pathname = usePathname()

  // 가장 긴 경로 매칭을 활성으로 (예: /about/history 가 /about 보다 우선)
  const activeHref = items
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0]

  return (
    <nav className="sticky top-20 z-40 border-b border-line bg-paper" aria-label={label}>
      <Container size="wide" className="flex gap-1.5 overflow-x-auto">
        {items.map((item) => {
          const active = item.href === activeHref
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex-none whitespace-nowrap border-b-2 px-4 py-[18px] text-[15px] font-bold transition ${
                active ? 'border-accent text-accent-deep' : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </Container>
    </nav>
  )
}
