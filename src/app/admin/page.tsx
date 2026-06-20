import { verifySession } from '@/lib/dal'

export default async function AdminDashboard() {
  await verifySession()

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-ink">Dashboard</h1>
      <div className="rounded-xl bg-paper p-5 text-sm leading-6 text-ink-muted shadow-sm">
        Use the sidebar to manage posts, bulletins, gallery albums, and logs.
      </div>
    </div>
  )
}
