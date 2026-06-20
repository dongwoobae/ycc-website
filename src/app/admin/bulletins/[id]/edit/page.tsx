import Link from 'next/link'
import { notFound } from 'next/navigation'
import BulletinForm from '@/components/admin/BulletinForm'
import { getBulletinForAdmin, updateBulletin, type BulletinFormInput } from '@/lib/actions/bulletins'
import { verifySession } from '@/lib/dal'

interface EditBulletinPageProps {
  params: Promise<{ id: string }>
}

export default async function EditBulletinPage({ params }: EditBulletinPageProps) {
  await verifySession()

  const { id } = await params
  const bulletin = await getBulletinForAdmin(id)
  if (!bulletin) notFound()

  const initialValue: BulletinFormInput = {
    bulletinDate: bulletin.bulletinDate,
    volume: bulletin.volume ?? '',
    issue: bulletin.issue ?? '',
    theme: bulletin.theme ?? '',
    scripture: bulletin.scripture ?? '',
    sections: bulletin.sections ?? [],
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">주보 관리</p>
          <h1 className="mt-1 text-xl font-bold text-ink">주보 수정</h1>
        </div>
        <Link href="/admin/bulletins" className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface">
          목록
        </Link>
      </div>
      <BulletinForm submitLabel="변경 저장" initialValue={initialValue} submitAction={updateBulletin.bind(null, id)} />
    </div>
  )
}
