import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { canViewServerLog } from '@/lib/admin'
import AdminSidebar from '@/components/admin/AdminSidebar'

const adminNav = [
  { label: '대시보드', href: '/admin' },
  { label: '설교 관리', href: '/admin/sermons' },
  { label: '소식/공지 관리', href: '/admin/posts' },
  { label: '주보 관리', href: '/admin/bulletins' },
  { label: '갤러리 관리', href: '/admin/gallery' },
  { label: '서버 로그', href: '/admin/log' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/sign-in')

  const navItems = canViewServerLog(session.user.email)
    ? adminNav
    : adminNav.filter((item) => item.href !== '/admin/log')

  return (
    <div className="min-h-screen bg-bg lg:flex">
      <AdminSidebar navItems={navItems} email={session.user.email} />
      <div className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
    </div>
  )
}
