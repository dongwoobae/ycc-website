import Link from 'next/link'
// TODO: 인증 미들웨어 추가 (Supabase session 체크)

const adminNav = [
  { label: '대시보드', href: '/admin' },
  { label: '설교 관리', href: '/admin/sermons' },
  { label: '소식/공지 관리', href: '/admin/posts' },
  { label: '서버 로그', href: '/admin/log' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-52 shrink-0 bg-gray-900 px-4 py-6 text-gray-200">
        <p className="mb-4 text-xs uppercase tracking-wider text-gray-500">관리자</p>
        <nav className="space-y-1">
          {adminNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm transition hover:bg-gray-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1 bg-gray-50 p-8">{children}</div>
    </div>
  )
}
