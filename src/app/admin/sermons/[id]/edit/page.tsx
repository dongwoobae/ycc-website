import Image from 'next/image'
import { notFound } from 'next/navigation'
import SermonEditForm from '@/components/admin/SermonEditForm'
import { getSermonForAdmin } from '@/lib/actions/sermons'
import { verifySession } from '@/lib/dal'

export default async function EditSermonPage({ params }: { params: Promise<{ id: string }> }) {
  await verifySession()
  const { id } = await params
  const row = await getSermonForAdmin(id)
  if (!row) notFound()

  const isCustom = row.customThumbnailUrl != null
  const currentThumbnail = row.customThumbnailUrl ?? row.thumbnailUrl ?? undefined

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-xl font-bold text-ink">설교 편집</h1>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <SermonEditForm
          id={row.id}
          initial={{
            title: row.title,
            displayTitle: row.displayTitle ?? '',
            preacher: row.preacher ?? '',
            worshipType: row.worshipType,
            sermonDate: row.sermonDate,
          }}
          summaryStatus={row.summaryStatus ?? 'none'}
          quickSummary={row.quickSummary ?? []}
          chapters={row.chapters ?? []}
          backgrounds={row.thumbnailBackgrounds ?? {}}
          cutoutUrl={row.thumbnailCutoutUrl ?? undefined}
          candidates={row.thumbnailCandidates ?? []}
          texts={row.thumbnailTexts ?? {}}
          appliedThumbnailUrl={row.customThumbnailUrl ?? undefined}
        />
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg border border-line p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">현재 썸네일</span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  isCustom ? 'bg-green-100 text-green-700' : 'bg-surface text-ink-muted'
                }`}
              >
                {isCustom ? '생성됨' : 'YouTube'}
              </span>
            </div>
            {currentThumbnail ? (
              <div className="relative aspect-video overflow-hidden rounded-md bg-surface">
                <Image
                  src={currentThumbnail}
                  alt="현재 설교 썸네일"
                  fill
                  sizes="20rem"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-md bg-surface text-sm text-ink-muted">
                썸네일 없음
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
