import SermonAdminTable from '@/components/admin/SermonAdminTable'
import { getSermonsForAdmin } from '@/lib/actions/sermons'
import { verifySession } from '@/lib/dal'

export default async function AdminSermonsPage() {
  await verifySession()
  const rows = await getSermonsForAdmin()

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-ink">Sermons</h1>
      </div>
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
