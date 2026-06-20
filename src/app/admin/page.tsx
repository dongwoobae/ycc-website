import { verifySession } from '@/lib/dal'

export default async function AdminDashboard() {
  await verifySession()

  const stats = [
    { label: 'Total sermons', value: '-' },
    { label: 'Total posts', value: '-' },
    { label: 'This week views', value: '-' },
    { label: 'Recent logs', value: '-' },
  ]

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-ink">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl bg-paper p-5 shadow-sm">
            <p className="text-sm text-ink-muted">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-ink">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
