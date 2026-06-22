'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useSyncExternalStore, type ReactNode } from 'react'

const aboutChildren = [
  { label: '소개', href: '/about' },
  { label: '인사말', href: '/about/greeting' },
  { label: '연혁', href: '/about/history' },
  { label: '섬기는 분들', href: '/about/serving' },
  { label: '예배시간·오시는 길', href: '/about/visit' },
]

const newsChildren = [
  { label: '소식', href: '/news' },
  { label: '갤러리', href: '/gallery' },
]

type NavItem =
  | { kind: 'accordion'; key: string; label: string; icon: IconName; section: string; children: { label: string; href: string }[] }
  | { kind: 'link'; label: string; icon: IconName; href: string; section: string }

const NAV: NavItem[] = [
  { kind: 'accordion', key: 'about', label: '교회소개', icon: 'info', section: '/about', children: aboutChildren },
  { kind: 'link', label: '예배·설교', icon: 'book', href: '/sermons', section: '/sermons' },
  { kind: 'link', label: '주보', icon: 'file', href: '/bulletins', section: '/bulletins' },
  { kind: 'accordion', key: 'news', label: '교회소식', icon: 'news', section: '/news', children: newsChildren },
]

const CTA = { label: '처음 오세요', icon: 'heart' as const, href: '/newfamily' }

const PIN_KEY = 'ycc-sidebar-pinned'

type IconName = 'info' | 'book' | 'file' | 'news' | 'heart' | 'chevron' | 'pin'

const ICON_PATHS: Record<IconName, ReactNode> = {
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16.5v-5" />
      <path d="M12 8h.01" />
    </>
  ),
  book: (
    <>
      <path d="M12 7v13" />
      <path d="M3 18.5V5a1 1 0 0 1 1-1h4.5A3.5 3.5 0 0 1 12 7a3.5 3.5 0 0 1 3.5-3H20a1 1 0 0 1 1 1v13.5a1 1 0 0 1-1 1h-5.5A2.5 2.5 0 0 0 12 22a2.5 2.5 0 0 0-2.5-2.5H4a1 1 0 0 1-1-1z" />
    </>
  ),
  file: (
    <>
      <path d="M14.5 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V7.5z" />
      <path d="M14.5 3v4.5H19" />
      <path d="M8.5 13h7" />
      <path d="M8.5 16.5h5" />
    </>
  ),
  news: (
    <>
      <path d="M3.5 9.5 20 5v12L3.5 13.5z" />
      <path d="M3.5 9.5v4" />
      <path d="M11.8 16.4a2.6 2.6 0 0 1-5 .1" />
    </>
  ),
  heart: <path d="M19 13.6c1.3-1.3 2.5-2.8 2.5-4.8A4.2 4.2 0 0 0 17.3 4.6c-1.5 0-2.6.5-3.8 1.9-1.2-1.4-2.3-1.9-3.8-1.9A4.2 4.2 0 0 0 5.5 8.8c0 2 1.2 3.5 2.5 4.8L14 19z" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  pin: (
    <>
      <path d="m13 5 6 6" />
      <path d="M14.5 3.5 20.5 9.5" />
      <path d="M9 21v-5l-3-3 8-3 3 3-3 8z" />
    </>
  ),
}

function Icon({ name, sw = 1.7 }: { name: IconName; sw?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICON_PATHS[name]}
    </svg>
  )
}

const matchesSection = (pathname: string, section: string) => pathname === section || pathname.startsWith(`${section}/`)

const activeSections = (pathname: string) => {
  const next = new Set<string>()
  NAV.forEach((item) => {
    if (item.kind === 'accordion' && matchesSection(pathname, item.section)) next.add(item.key)
  })
  return next
}

// 핀 상태를 localStorage(외부 스토어)로 구독 — 서버 스냅샷은 false 라 하이드레이션 안전
const PIN_EVENT = 'ycc-pin-change'
const subscribePin = (callback: () => void) => {
  window.addEventListener(PIN_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(PIN_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}
const getPinSnapshot = () => {
  try {
    return localStorage.getItem(PIN_KEY) === '1'
  } catch {
    return false
  }
}

export default function Sidebar() {
  const pathname = usePathname()

  const pinned = useSyncExternalStore(subscribePin, getPinSnapshot, () => false)

  const [open, setOpen] = useState<Set<string>>(() => activeSections(pathname))

  // 라우트 변경 시 활성 하위메뉴를 가진 아코디언 자동 펼침 (렌더 단계 상태 보정 — 사용자가 연 항목은 유지)
  const [trackedPath, setTrackedPath] = useState(pathname)
  if (trackedPath !== pathname) {
    setTrackedPath(pathname)
    setOpen((prev) => new Set([...prev, ...activeSections(pathname)]))
  }

  const togglePin = () => {
    try {
      localStorage.setItem(PIN_KEY, pinned ? '0' : '1')
    } catch {
      /* 무시 */
    }
    window.dispatchEvent(new Event(PIN_EVENT))
  }

  const toggleSection = (key: string) => {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <aside className="ycc-side" aria-label="주요 메뉴" data-pinned={pinned ? 'true' : undefined}>
      <div className="ycc-panel">
        <Link href="/" className="ycc-logo" aria-label="영천중앙교회 홈">
          <span className="ycc-mark">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M13.6 2h-3.2v6.4H4v3.2h6.4V22h3.2V11.6H20V8.4h-6.4z" />
            </svg>
          </span>
          <span className="ycc-wordmark">
            <b>영천중앙교회</b>
            <small>YEONGCHEON CENTRAL</small>
          </span>
        </Link>

        <button
          type="button"
          className="ycc-toggle"
          aria-label="사이드바 고정/접기"
          aria-pressed={pinned}
          onClick={togglePin}
        >
          <Icon name="chevron" sw={2} />
        </button>

        <nav className="ycc-nav">
          {NAV.map((item) => {
            if (item.kind === 'link') {
              const active = matchesSection(pathname, item.section)
              return (
                <div key={item.href} className="ycc-item">
                  <Link href={item.href} className={`ycc-link${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
                    <span className={`ycc-ico${active ? ' dot-active' : ''}`}>
                      <Icon name={item.icon} />
                    </span>
                    <span className="ycc-txt">{item.label}</span>
                  </Link>
                </div>
              )
            }

            const sectionActive = matchesSection(pathname, item.section)
            const isOpen = open.has(item.key)
            return (
              <div key={item.key} className={`ycc-item${isOpen ? ' open' : ''}`}>
                <button
                  type="button"
                  className={`ycc-link${sectionActive ? ' is-active' : ''}`}
                  aria-expanded={isOpen}
                  onClick={() => toggleSection(item.key)}
                >
                  <span className={`ycc-ico${sectionActive ? ' dot-active' : ''}`}>
                    <Icon name={item.icon} />
                  </span>
                  <span className="ycc-txt">{item.label}</span>
                  <span className="ycc-chev">
                    <Icon name="chevron" sw={2} />
                  </span>
                </button>
                <div className="ycc-sub">
                  <div className="ycc-sub-inner">
                    <div className="ycc-sub-pad">
                      {item.children.map((child) => {
                        const childActive = pathname === child.href
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`ycc-sublink${childActive ? ' is-active' : ''}`}
                            aria-current={childActive ? 'page' : undefined}
                          >
                            <span className="ycc-subtxt">{child.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </nav>

        <Link
          href={CTA.href}
          className={`ycc-cta${pathname === CTA.href ? ' is-active' : ''}`}
          aria-current={pathname === CTA.href ? 'page' : undefined}
        >
          <span className="ycc-ico">
            <Icon name={CTA.icon} />
          </span>
          <span className="ycc-txt">{CTA.label}</span>
        </Link>
      </div>
    </aside>
  )
}
