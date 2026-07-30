import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { posts } from '@/lib/db/schema'
import { deletePost, togglePin } from '@/lib/actions/posts'
import { isScheduled } from '@/lib/data/posts'
import { verifySession } from '@/lib/dal'
import { formatKstDate, formatKstDateTime } from '@/lib/date'
import SubmitButton from '@/components/admin/SubmitButton'

export default async function AdminPostsPage() {
  await verifySession()

  const rows = await db.select().from(posts).orderBy(desc(posts.isPinned), desc(posts.createdAt))
  const now = new Date()

  return (
    <div>

      <div className="overflow-x-auto rounded-xl bg-paper shadow-sm">
        <table className="min-w-[52rem] w-full text-sm">
          <thead className="bg-surface text-ink-muted">
            <tr>
              {['날짜', '제목', '카테고리', '고정', '공개', '관리'].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t border-line">
                <td className="px-4 py-3 text-ink-muted" colSpan={6}>
                  등록된 게시글이 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((post) => (
                <tr key={post.id} className="border-t border-line">
                  <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                    {formatKstDate(post.publishedAt ?? post.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">
                    {/* 공개 중인 글만 새 창으로 공개 페이지 미리보기 — 비공개·예약 글은 공개 라우트가 404 */}
                    {post.isPublished && !isScheduled(post, now) ? (
                      <a
                        href={`/news/${post.id}`}
                        target="_blank"
                        rel="noreferrer"
                        title="공개 페이지 새 창으로 열기"
                        className="hover:underline"
                      >
                        {post.title}
                      </a>
                    ) : (
                      post.title
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{post.category}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{post.isPinned ? '고정' : '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                    {isScheduled(post, now) ? (
                      <span title={`${formatKstDateTime(post.publishedAt)} 공개 예정`} className="text-accent-deep">
                        예약
                      </span>
                    ) : post.isPublished ? (
                      '공개'
                    ) : (
                      '비공개'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/posts/${post.id}/edit`}
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface"
                      >
                        수정
                      </Link>
                      <form action={togglePin.bind(null, post.id, !post.isPinned)}>
                        <button
                          type="submit"
                          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface"
                        >
                          {post.isPinned ? '고정 해제' : '고정'}
                        </button>
                      </form>
                      <form action={deletePost.bind(null, post.id)}>
                        <SubmitButton
                          confirmMessage="게시글을 삭제합니다. 계속할까요?"
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
