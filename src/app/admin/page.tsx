import { verifySession } from '@/lib/dal'
import { getAdminDashboardStats } from '@/lib/data/admin-dashboard'
import DashboardView from '@/components/admin/DashboardView'

export default async function AdminDashboard() {
  await verifySession()
  const stats = await getAdminDashboardStats()

  return <DashboardView stats={stats} />
}
