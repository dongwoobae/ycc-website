import SermonAdminTable from '@/components/admin/SermonAdminTable'
import AdminPageHero from '@/components/admin/AdminPageHero'
import { getSermonsForAdmin } from '@/lib/actions/sermons'
import { verifySession } from '@/lib/dal'

export default async function AdminSermonsPage() {
  await verifySession()
  const rows = await getSermonsForAdmin()

  return (
    <div>
      <AdminPageHero
        title="설교 관리"
        image="https://images.unsplash.com/photo-1473773508845-188df298d2d1?auto=format&fit=crop&w=1600&q=80"
      />
      <SermonAdminTable
        rows={rows.map((row) => ({
          id: row.id,
          sermonDate: row.sermonDate,
          title: row.title,
          preacher: row.preacher,
          worshipType: row.worshipType,
          isPublished: row.isPublished,
          summaryStatus: row.summaryStatus,
        }))}
      />
    </div>
  )
}
