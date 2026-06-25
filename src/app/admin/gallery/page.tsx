import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { galleryAlbums } from '@/lib/db/schema'
import { deleteAlbum } from '@/lib/actions/gallery'
import { verifySession } from '@/lib/dal'
import SubmitButton from '@/components/admin/SubmitButton'
import AdminPageHero from '@/components/admin/AdminPageHero'

function formatDate(value: string | null) {
  return value || '-'
}

export default async function AdminGalleryPage() {
  await verifySession()

  const rows = await db.select().from(galleryAlbums).orderBy(desc(galleryAlbums.eventDate), desc(galleryAlbums.createdAt))

  return (
    <div>
      <AdminPageHero
        title="갤러리 관리"
        image="https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1600&q=80"
        action={
          <Link
            href="/admin/gallery/new"
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-ink shadow-lg ring-1 ring-black/10 transition hover:bg-surface"
          >
            새 앨범
          </Link>
        }
      />

      <div className="overflow-x-auto rounded-xl bg-paper shadow-sm">
        <table className="min-w-[48rem] w-full text-sm">
          <thead className="bg-surface text-ink-muted">
            <tr>
              {['행사일', '표지', '앨범명', '공개', '관리'].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t border-line">
                <td className="px-4 py-3 text-ink-muted" colSpan={5}>
                  등록된 앨범이 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((album) => (
                <tr key={album.id} className="border-t border-line">
                  <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{formatDate(album.eventDate)}</td>
                  <td className="px-4 py-3">
                    <div className="size-16 overflow-hidden rounded-lg bg-surface">
                      {album.coverImgUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={album.coverImgUrl} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{album.title}</p>
                    {album.description ? <p className="mt-1 line-clamp-1 text-xs text-ink-muted">{album.description}</p> : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                    {album.isPublished ? '공개' : '비공개'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/gallery/${album.id}/edit`}
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface"
                      >
                        수정
                      </Link>
                      <form action={deleteAlbum.bind(null, album.id)}>
                        <SubmitButton
                          confirmMessage="앨범과 모든 사진 파일을 삭제합니다. 계속할까요?"
                          pendingLabel="삭제 중..."
                          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-surface"
                        >
                          삭제
                        </SubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
