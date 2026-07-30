import SermonAdminTable from '@/components/admin/SermonAdminTable'
import { getSermonsForAdmin } from '@/lib/actions/sermons'
import { verifySession } from '@/lib/dal'

export default async function AdminSermonsPage() {
  await verifySession()
  const rows = await getSermonsForAdmin()

  return (
    <div>
      <SermonAdminTable
        rows={rows.map((row) => ({
          id: row.id,
          sermonDate: row.sermonDate,
          title: row.title,
          displayTitle: row.displayTitle,
          preacher: row.preacher,
          worshipType: row.worshipType,
          isPublished: row.isPublished,
          summaryStatus: row.summaryStatus ?? 'none',
          hasCustomThumbnail: row.customThumbnailUrl != null,
        }))}
      />
    </div>
  )
}
