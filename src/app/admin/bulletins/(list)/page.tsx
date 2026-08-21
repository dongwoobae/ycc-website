import Link from 'next/link'
import { deleteBulletin, getBulletinsForAdmin } from '@/lib/actions/bulletins'
import { verifySession } from '@/lib/dal'
import SubmitButton from '@/components/admin/SubmitButton'

export default async function AdminBulletinsPage() {
  await verifySession()

  const rows = await getBulletinsForAdmin()

  return (
    <div>
      <div className="overflow-x-auto rounded-xl bg-paper shadow-sm">
        <table className="min-w-[48rem] w-full text-sm">
          <thead className="bg-surface text-ink-muted">
            <tr>
              {['날짜', '권/호', '설교 제목', '면', '공개', '관리'].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow />
            ) : (
              rows.map((bulletin) => <BulletinRow key={bulletin.id} bulletin={bulletin} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EmptyRow() {
  return (
    <tr className="border-t border-line">
      <td className="px-4 py-3 text-ink-muted" colSpan={6}>
        등록된 주보가 없습니다.
      </td>
    </tr>
  )
}

function BulletinRow({ bulletin }: { bulletin: Awaited<ReturnType<typeof getBulletinsForAdmin>>[number] }) {
  // 공개 주보만 새 창으로 공개 페이지 미리보기 — 비공개는 공개 라우트가 404.
  // 설교 제목이 없으면 날짜 칸이 링크를 대신한다.
  const publicLink = (label: string) => (
    <a
      href={`/bulletins/${bulletin.id}`}
      target="_blank"
      rel="noreferrer"
      title="공개 페이지 새 창으로 열기"
      className="hover:underline"
    >
      {label}
    </a>
  )
  return (
    <tr className="border-t border-line">
      <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
        {bulletin.isPublished && !bulletin.sermonTitle ? publicLink(bulletin.bulletinDate) : bulletin.bulletinDate}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
        {[bulletin.volume, bulletin.issue].filter(Boolean).join(' ') || '-'}
      </td>
      <td className="px-4 py-3 font-medium text-ink">
        {bulletin.isPublished && bulletin.sermonTitle ? publicLink(bulletin.sermonTitle) : bulletin.sermonTitle || '-'}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{(bulletin.pages ?? []).length}면</td>
      <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{bulletin.isPublished ? '공개' : '비공개'}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/bulletins/${bulletin.id}/edit`}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface"
          >
            수정
          </Link>
          <form action={deleteBulletin.bind(null, bulletin.id)}>
            <SubmitButton
              confirmMessage="주보와 원본 파일을 삭제합니다. 계속할까요?"
              pendingLabel="삭제 중..."
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-surface"
            >
              삭제
            </SubmitButton>
          </form>
        </div>
      </td>
    </tr>
  )
}
