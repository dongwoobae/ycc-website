import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { galleryAlbums } from '@/lib/db/schema'
import { deleteAlbum } from '@/lib/actions/gallery'

function formatDate(value: string | null) {
  return value || '-'
}

export default async function AdminGalleryPage() {
  const rows = await db.select().from(galleryAlbums).orderBy(desc(galleryAlbums.eventDate), desc(galleryAlbums.createdAt))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-ink">갤러리 관리</h1>
        <Link
          href="/admin/gallery/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-deep"
        >
          새 앨범
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl bg-paper shadow-sm">
        <table className="w-full text-sm">
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
                        <button
                          type="submit"
                          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-surface"
                        >
                          삭제
                        </button>
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
