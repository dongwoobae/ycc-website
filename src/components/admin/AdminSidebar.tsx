'use client'

import Link from 'next/link'
import { useState } from 'react'
import SignOutButton from '@/components/admin/SignOutButton'

interface AdminNavItem {
  label: string
  href: string
}

interface AdminSidebarProps {
  navItems: AdminNavItem[]
  email?: string | null
}

export default function AdminSidebar({ navItems, email }: AdminSidebarProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-bg px-4 lg:hidden">
        <Link href="/admin" className="text-base font-extrabold tracking-tight text-ink">
          관리자
        </Link>
        <button
          type="button"
          className="rounded-lg border border-line bg-paper p-2 text-ink transition hover:bg-surface"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? '관리 메뉴 닫기' : '관리 메뉴 열기'}
          aria-controls="admin-sidebar"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden
          >
            {open ? (
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
      </div>

      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-ink/45 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="관리 메뉴 닫기"
        />
      )}

      <aside
        id="admin-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col bg-ink px-4 py-6 text-bg transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:w-52 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-line">관리자</p>
          <button
            type="button"
            className="rounded-lg p-2 text-line transition hover:bg-accent-deep hover:text-bg lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="관리 메뉴 닫기"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm transition hover:bg-accent-deep"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-accent-deep/40 pt-4">
          {email && <p className="mb-2 break-all px-3 text-xs text-line">{email}</p>}
          <SignOutButton />
        </div>
      </aside>
    </>
  )
}
