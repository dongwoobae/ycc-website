'use client'

import Link from 'next/link'
import { useState } from 'react'
import Container from './Container'

const navGroups = [
  {
    label: '교회소개',
    href: '/about',
    children: [
      { label: '인사말', href: '/about' },
      { label: '섬기는 분들', href: '/about/serving' },
      { label: '교회연혁', href: '/about/history' },
      { label: '예배시간·오시는 길', href: '/about/visit' },
    ],
  },
  { label: '예배·설교', href: '/sermons' },
  { label: '주보', href: '/bulletins' },
  {
    label: '교회소식',
    href: '/news',
    children: [
      { label: '공지·소식', href: '/news' },
      { label: '갤러리', href: '/gallery' },
    ],
  },
]

export default function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/95 backdrop-blur">
      <Container className="flex h-[4.5rem] items-center justify-between">
        <Link href="/" className="font-serif text-2xl font-bold text-ink">
          영천중앙교회
        </Link>
        <nav className="hidden items-center gap-2 md:flex">
          {navGroups.map((item) => (
            <div key={item.href} className="group relative">
              <Link
                href={item.href}
                className="block rounded-full px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface hover:text-ink"
              >
                {item.label}
              </Link>
              {item.children && (
                <div className="invisible absolute left-0 top-full w-52 translate-y-2 rounded-lg border border-line bg-paper p-2 opacity-0 shadow-soft transition group-hover:visible group-hover:translate-y-1 group-hover:opacity-100">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="block rounded-md px-3 py-2 text-sm text-ink-muted hover:bg-surface hover:text-ink"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <button
          type="button"
          className="rounded-full border border-line px-3 py-2 text-sm text-ink md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          메뉴
        </button>
      </Container>
      {open && (
        <div className="border-t border-line bg-bg md:hidden">
          <Container className="py-4">
            <nav className="space-y-2">
              {navGroups.map((item) => (
                <div key={item.href} className="rounded-lg bg-paper p-2">
                  <Link
                    href={item.href}
                    className="block px-3 py-2 font-medium text-ink"
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                  {item.children && (
                    <div className="grid gap-1 pl-3">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="rounded-md px-3 py-2 text-sm text-ink-muted"
                          onClick={() => setOpen(false)}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </Container>
        </div>
      )}
    </header>
  )
}
