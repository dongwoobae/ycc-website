import Link from 'next/link'
import AlbumForm from '@/components/admin/AlbumForm'
import { createAlbum } from '@/lib/actions/gallery'

export default function NewGalleryAlbumPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">갤러리 관리</p>
          <h1 className="mt-1 text-xl font-bold text-ink">새 앨범</h1>
        </div>
        <Link
          href="/admin/gallery"
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface"
        >
          목록
        </Link>
      </div>
      <AlbumForm submitLabel="앨범 작성" submitAction={createAlbum} coverRequired />
    </div>
  )
}
