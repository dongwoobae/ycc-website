'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import Container from './Container'

const tourLinks = [
  { label: '갤러리', href: '/gallery' },
  { label: '교회소개', href: '/about' },
  { label: '섬기는 분들', href: '/about/serving' },
  { label: '교회연혁', href: '/about/history' },
]

const mobileLinks = [
  { label: '예배', href: '/about/visit' },
  ...tourLinks,
  { label: '설교', href: '/sermons' },
  { label: '오시는 길', href: '/#visit' },
  { label: '주보', href: '/bulletins' },
  { label: '교회소식', href: '/news' },
]

export default function Header() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const frame = useRef<number | null>(null)

  const isImmersive = pathname === '/' || pathname === '/newfamily'
  const isSolid = !isImmersive || isScrolled || menuOpen

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMenuOpen(false))
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
        isSolid ? 'border-line bg-bg/85 text-ink shadow-subtle backdrop-blur' : 'border-transparent bg-transparent text-white',
      ].join(' '),
    [isImmersive, isSolid],
  )

  const navLinkClassName = isSolid
    ? 'text-ink-muted hover:bg-surface/80 hover:text-ink'
    : 'text-white/85 hover:bg-white/10 hover:text-white'

  return (
    <header className={headerClassName}>
      <Container size="wide" className="flex h-20 items-center justify-between px-6 min-[960px]:px-10">
        <Link href="/" className="group inline-flex flex-col leading-none" aria-label="영천중앙교회 홈">
          <span className="font-serif text-[21px] font-extrabold tracking-tight">영천중앙교회</span>
          <span className="mt-1 text-[10px] font-semibold tracking-[0.24em] text-accent">YEONGCHEON CENTRAL</span>
        </Link>

        <nav className="hidden items-center gap-2 min-[960px]:flex" aria-label="주요 메뉴">
          <Link className={`rounded-full px-4 py-2 text-[14.5px] font-semibold transition ${navLinkClassName}`} href="/about/visit">
            예배
          </Link>
          <div className="group relative">
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-[14.5px] font-semibold transition ${navLinkClassName}`}
              aria-haspopup="true"
            >
              둘러보기
            </button>
            <div className="invisible absolute left-0 top-full pt-3 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <div className="w-52 translate-y-1 rounded-lg border border-line bg-paper p-2 shadow-soft transition group-focus-within:translate-y-0 group-hover:translate-y-0">
                {tourLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block rounded-md px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface hover:text-ink"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <Link className={`rounded-full px-4 py-2 text-[14.5px] font-semibold transition ${navLinkClassName}`} href="/sermons">
            설교
          </Link>
          <Link className={`rounded-full px-4 py-2 text-[14.5px] font-semibold transition ${navLinkClassName}`} href="/#visit">
            오시는 길
          </Link>
          <Link
            className="motion-hover rounded-full bg-accent px-5 py-2.5 text-[14.5px] font-bold text-white transition hover:-translate-y-0.5 hover:bg-accent-deep"
            href="/newfamily"
          >
            처음 오세요
          </Link>
        </nav>

        <button
          type="button"
          className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition min-[960px]:hidden ${
            isSolid ? 'border-line text-ink hover:bg-surface' : 'border-white/40 text-white hover:bg-white/10'
          }`}
          onClick={() => setMenuOpen((value) => !value)}
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

      {menuOpen && (
        <div id="mobile-navigation" className="fixed inset-0 top-20 z-40 overflow-y-auto bg-bg min-[960px]:hidden">
          <Container size="wide" className="py-8">
            <nav className="grid gap-1" aria-label="모바일 메뉴">
              {mobileLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="border-b border-line px-1 py-4 text-2xl font-extrabold tracking-tight text-ink transition hover:text-accent"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/newfamily"
                onClick={() => setMenuOpen(false)}
                className="motion-hover mt-6 rounded-full bg-accent px-6 py-4 text-center text-lg font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-accent-deep"
              >
                처음 오세요
              </Link>
            </nav>
          </Container>
        </div>
      )}
    </header>
  )
}
