import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import SignOutButton from '@/components/admin/SignOutButton'

const adminNav = [
  { label: '대시보드', href: '/admin' },
  { label: '설교 관리', href: '/admin/sermons' },
  { label: '소식/공지 관리', href: '/admin/posts' },
  { label: '갤러리 관리', href: '/admin/gallery' },
  { label: '서버 로그', href: '/admin/log' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/sign-in')

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-52 shrink-0 flex-col bg-ink px-4 py-6 text-bg">
        <p className="mb-4 text-xs uppercase tracking-wider text-line">관리자</p>
        <nav className="space-y-1">
          {adminNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm transition hover:bg-accent-deep"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-accent-deep/40 pt-4">
          <p className="mb-2 px-3 text-xs text-line">{session.user.email}</p>
          <SignOutButton />
        </div>
      </aside>
      <div className="flex-1 bg-bg p-8">{children}</div>
    </div>
  )
}
