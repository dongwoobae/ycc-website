import Link from 'next/link'
import { notFound } from 'next/navigation'
import AlbumForm, { type AlbumFormInitialValue } from '@/components/admin/AlbumForm'
import GalleryImageManager from '@/components/admin/GalleryImageManager'
import { addImage, deleteImage, reorderImages, updateAlbum } from '@/lib/actions/gallery'
import { getAlbumForAdmin } from '@/lib/data/gallery'
import { verifySession } from '@/lib/dal'

interface EditGalleryAlbumPageProps {
  params: Promise<{ id: string }>
}

export default async function EditGalleryAlbumPage({ params }: EditGalleryAlbumPageProps) {
  await verifySession()

  const { id } = await params
  const album = await getAlbumForAdmin(id)
  if (!album) notFound()

  const initialValue: AlbumFormInitialValue = {
    title: album.title,
    description: album.description ?? '',
    eventDate: album.eventDate,
    isPublished: album.isPublished,
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">갤러리 관리</p>
          <h1 className="mt-1 text-xl font-bold text-ink">앨범 수정</h1>
        </div>
        <Link
          href="/admin/gallery"
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface"
        >
          목록
        </Link>
      </div>

      <div className="grid gap-6">
        <AlbumForm submitLabel="변경 저장" initialValue={initialValue} submitAction={updateAlbum.bind(null, id)} />
        <GalleryImageManager
          images={album.images}
          addAction={addImage.bind(null, id)}
          deleteAction={deleteImage}
          reorderAction={reorderImages.bind(null, id)}
        />
      </div>
    </div>
  )
}
