import Link from 'next/link'
import { deleteBulletin, getBulletinsForAdmin } from '@/lib/actions/bulletins'

export default async function AdminBulletinsPage() {
  const rows = await getBulletinsForAdmin()

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-ink">주보 관리</h1>
        <Link href="/admin/bulletins/new" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-deep">
          새 주보
        </Link>
      </div>
      <div className="overflow-x-auto rounded-xl bg-paper shadow-sm">
        <table className="min-w-[48rem] w-full text-sm">
          <thead className="bg-surface text-ink-muted">
            <tr>
              {['날짜', '권/호', '주제', '공개', '관리'].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left font-medium">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? <EmptyRow /> : rows.map((bulletin) => <BulletinRow key={bulletin.id} bulletin={bulletin} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EmptyRow() {
  return (
    <tr className="border-t border-line">
      <td className="px-4 py-3 text-ink-muted" colSpan={5}>등록된 주보가 없습니다.</td>
    </tr>
  )
}

function BulletinRow({ bulletin }: { bulletin: Awaited<ReturnType<typeof getBulletinsForAdmin>>[number] }) {
  return (
    <tr className="border-t border-line">
      <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{bulletin.bulletinDate}</td>
      <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{[bulletin.volume, bulletin.issue].filter(Boolean).join(' ') || '-'}</td>
      <td className="px-4 py-3 font-medium text-ink">{bulletin.theme || '-'}</td>
      <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{bulletin.isPublished ? '공개' : '비공개'}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/bulletins/${bulletin.id}/edit`} className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface">
            수정
          </Link>
          <form action={deleteBulletin.bind(null, bulletin.id)}>
            <button type="submit" className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-surface">
              삭제
            </button>
          </form>
        </div>
      </td>
    </tr>
  )
}
