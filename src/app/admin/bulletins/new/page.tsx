import Link from 'next/link'
import BulletinForm from '@/components/admin/BulletinForm'
import { createBulletin } from '@/lib/actions/bulletins'

export default function NewBulletinPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">주보 관리</p>
          <h1 className="mt-1 text-xl font-bold text-ink">새 주보</h1>
        </div>
        <Link href="/admin/bulletins" className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface">
          목록
        </Link>
      </div>
      <BulletinForm submitLabel="주보 작성" submitAction={createBulletin} />
    </div>
  )
}
