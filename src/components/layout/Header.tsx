'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import BrandLogo from './BrandLogo'
import Container from './Container'
import { navLinks } from '@/lib/nav'

export default function Header() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [megaOpen, setMegaOpen] = useState(false)
  const [openSection, setOpenSection] = useState<string | null>(null)
  const frame = useRef<number | null>(null)

  const isImmersive = pathname === '/' || pathname === '/newfamily'
  const isSolid = !isImmersive || isScrolled || menuOpen || megaOpen
  // 투명 헤더일 때, 히어로가 밝으면(홈: 크림 단색) 어두운 글자, 어두우면(newfamily: 네이비) 흰 글자.
  const heroIsLight = pathname === '/'

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      setMenuOpen(false)
      setMegaOpen(false)
    })
    return () => window.cancelAnimationFrame(id)
  }, [pathname])

  useEffect(() => {
    if (!isImmersive) {
      return undefined
    }

    const update = () => {
      frame.current = null
      setIsScrolled(window.scrollY > 40)
    }

    const onScroll = () => {
      if (frame.current !== null) return
      frame.current = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame.current !== null) {
        window.cancelAnimationFrame(frame.current)
        frame.current = null
      }
    }
  }, [isImmersive])

  useEffect(() => {
    if (!menuOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const headerClassName = useMemo(
    () =>
      [
        isImmersive ? 'fixed' : 'sticky',
        'left-0 right-0 top-0 z-50 border-b transition-[background-color,border-color,color] duration-300',
        isSolid
          ? 'border-line bg-paper text-ink shadow-subtle'
          : heroIsLight
            ? 'border-transparent bg-transparent text-ink'
            : 'border-transparent bg-transparent text-white',
      ].join(' '),
    [isImmersive, isSolid, heroIsLight],
  )

  const navLinkClassName = isSolid
    ? 'text-ink-muted hover:bg-accent-deep/[0.06] hover:text-accent-deep'
    : heroIsLight
      ? 'text-ink-muted hover:bg-accent-deep/[0.06] hover:text-accent-deep'
      : 'text-white/90 hover:bg-white/10 hover:text-white'

  const activeNavClassName = isSolid
    ? 'bg-accent-deep/[0.07] text-accent-deep'
    : heroIsLight
      ? 'bg-accent-deep/[0.07] text-accent-deep'
      : 'bg-white/15 text-white'

  const matchesSection = (section: string) => pathname === section || pathname.startsWith(`${section}/`)

  const isActiveItem = (item: (typeof navLinks)[number]) =>
    [
      item.section,
      ...(item.groups?.map((group) => group.href) ?? []),
      ...(item.children?.map((child) => child.href) ?? []),
    ].some(matchesSection)

  return (
    <>
      <header
        className={`${headerClassName} group/gnb`}
        onMouseEnter={() => setMegaOpen(true)}
        onMouseLeave={() => setMegaOpen(false)}
        onFocus={() => setMegaOpen(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setMegaOpen(false)
        }}
      >
      <Container size="wide" className="flex h-20 items-center justify-between px-6 min-[960px]:px-10">
        <Link href="/" className="group inline-flex leading-none" aria-label="영천중앙교회 홈">
          <BrandLogo />
        </Link>

        <nav className="hidden items-center gap-1 min-[960px]:flex" aria-label="주요 메뉴">
          {navLinks
            .filter((link) => link.section !== '/newfamily')
            .map((link) => {
              const active = isActiveItem(link)
              const itemClass = `rounded-full px-4 py-2 text-[16px] font-bold transition ${active ? activeNavClassName : navLinkClassName}`
              return (
                <Link key={link.href} href={link.href} className={itemClass} aria-current={active ? 'page' : undefined}>
                  {link.label}
                </Link>
              )
            })}
          <Link
            href="/newfamily"
            className="ml-2 rounded-full bg-accent-deep px-5 py-2.5 text-[15px] font-extrabold text-white transition hover:bg-gold hover:text-[#1D1503]"
            aria-current={matchesSection('/newfamily') ? 'page' : undefined}
          >
            처음 오셨나요?
          </Link>
        </nav>

        <button
          type="button"
          className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition min-[960px]:hidden ${
            isSolid
              ? 'border-line text-ink hover:bg-surface'
              : heroIsLight
                ? 'border-ink/25 text-ink hover:bg-ink/5'
                : 'border-white/40 text-white hover:bg-white/10'
          }`}
          onClick={() => {
            if (!menuOpen) {
              // 메뉴를 열 때 현재 보고 있는 섹션을 자동으로 펼친다.
              const active = navLinks.find((link) => isActiveItem(link))
              setOpenSection(active ? active.section : null)
            }
            setMenuOpen((value) => !value)
          }}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            {menuOpen ? (
              <>
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </>
            ) : (
              <>
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </>
            )}
          </svg>
        </button>
      </Container>

      {/* 데스크탑 전체 GNB 메가 패널 — 헤더 hover/focus 시 전체폭으로 펼침 */}
      <div
        className={`absolute left-0 right-0 top-full hidden transition-opacity duration-200 min-[960px]:block ${
          megaOpen ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        <div className="border-t border-line bg-paper text-ink shadow-subtle">
          <Container size="wide" className="grid grid-cols-5 gap-x-6 py-9">
            {navLinks.map((section) => (
              <div key={section.href}>
                <Link
                  href={section.href}
                  className="block pb-3 text-[15px] font-extrabold tracking-tight text-ink transition hover:text-accent-deep"
                >
                  {section.label}
                </Link>
                {section.groups ? (
                  <div className="space-y-4 border-t border-line pt-3">
                    {section.groups.map((group) => (
                      <div key={group.href}>
                        <Link
                          href={group.href}
                          className="block text-[13.5px] font-bold text-ink transition hover:text-accent-deep"
                        >
                          {group.label}
                        </Link>
                        <ul className="mt-1 space-y-1">
                          {group.children.map((child) => (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                className="block py-1 text-[13px] font-medium text-ink-muted transition hover:text-accent-deep"
                              >
                                {child.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-1 border-t border-line pt-3">
                    {section.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          className="block py-1 text-[13.5px] font-medium text-ink-muted transition hover:text-accent-deep"
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </Container>
        </div>
      </div>
      </header>

      {menuOpen && (
        <div id="mobile-navigation" className="fixed inset-0 z-[60] min-[960px]:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/35"
            onClick={() => setMenuOpen(false)}
            aria-label="모바일 메뉴 닫기"
          />
          <aside className="absolute right-0 top-0 h-full w-[80%] max-w-sm overflow-y-auto bg-bg shadow-lifted transition-transform duration-300 ease-out translate-x-0">
            <button
              type="button"
              className="absolute right-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-paper text-ink transition hover:bg-surface"
              onClick={() => setMenuOpen(false)}
              aria-label="메뉴 닫기"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
            <Container size="wide" className="py-24">
            <nav className="grid gap-1" aria-label="모바일 메뉴">
              {navLinks.map((link) => {
                const expanded = openSection === link.section
                const panelId = `mobile-section-${link.section.replace(/\//g, '')}`
                return (
                  <div key={link.href} className="border-b border-line">
                    <button
                      type="button"
                      onClick={() => setOpenSection((current) => (current === link.section ? null : link.section))}
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      className="flex w-full items-center justify-between gap-3 px-1 py-4 text-2xl font-extrabold tracking-tight text-ink transition hover:text-accent"
                    >
                      <span>{link.label}</span>
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                        className={`shrink-0 text-ink-muted transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    {link.children && (
                      <div
                        id={panelId}
                        className={`grid transition-all duration-300 ease-out ${
                          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="flex flex-col gap-1 px-1 pb-4">
                            {link.groups
                              ? link.groups.map((group) => (
                                  <div key={group.href} className="flex flex-col gap-1">
                                    <Link
                                      href={group.href}
                                      onClick={() => setMenuOpen(false)}
                                      className="pt-2 text-[16px] font-bold text-ink transition hover:text-accent"
                                    >
                                      {group.label}
                                    </Link>
                                    {group.children.map((child) => (
                                      <Link
                                        key={child.href}
                                        href={child.href}
                                        onClick={() => setMenuOpen(false)}
                                        className="py-1.5 pl-3 text-[15px] font-semibold text-ink-muted transition hover:text-accent"
                                      >
                                        {child.label}
                                      </Link>
                                    ))}
                                  </div>
                                ))
                              : link.children.map((child) => (
                                  <Link
                                    key={child.href}
                                    href={child.href}
                                    onClick={() => setMenuOpen(false)}
                                    className="py-1.5 text-[15px] font-semibold text-ink-muted transition hover:text-accent"
                                  >
                                    {child.label}
                                  </Link>
                                ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>
            </Container>
          </aside>
        </div>
      )}
    </>
  )
}
