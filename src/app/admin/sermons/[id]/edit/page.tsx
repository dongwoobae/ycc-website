import { notFound } from 'next/navigation'
import SermonEditForm from '@/components/admin/SermonEditForm'
import { getSermonForAdmin } from '@/lib/actions/sermons'
import { verifySession } from '@/lib/dal'

export default async function EditSermonPage({ params }: { params: Promise<{ id: string }> }) {
  await verifySession()
  const { id } = await params
  const row = await getSermonForAdmin(id)
  if (!row) notFound()

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-xl font-bold text-ink">설교 편집</h1>
      <SermonEditForm
        id={row.id}
        initial={{
          title: row.title,
          displayTitle: row.displayTitle ?? '',
          preacher: row.preacher ?? '',
          worshipType: row.worshipType,
          sermonDate: row.sermonDate,
        }}
        summaryStatus={row.summaryStatus}
        quickSummary={row.quickSummary ?? []}
        chapters={row.chapters ?? []}
        backgrounds={row.thumbnailBackgrounds ?? {}}
      />
    </div>
  )
}
