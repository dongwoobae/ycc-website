import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { posts } from '@/lib/db/schema'
import { deletePost, togglePin } from '@/lib/actions/posts'
import { verifySession } from '@/lib/dal'
import { formatKstDate } from '@/lib/date'
import AdminPageHero from '@/components/admin/AdminPageHero'

export default async function AdminPostsPage() {
  await verifySession()

  const rows = await db.select().from(posts).orderBy(desc(posts.isPinned), desc(posts.createdAt))

  return (
    <div>
      <AdminPageHero
        title="소식/공지 관리"
        image="https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1600&q=80"
        action={
          <Link
            href="/admin/posts/new"
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-ink shadow-lg ring-1 ring-black/10 transition hover:bg-surface"
          >
            새 게시글
          </Link>
        }
      />

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
                  <td className="px-4 py-3 font-medium text-ink">{post.title}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{post.category}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{post.isPinned ? '고정' : '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                    {post.isPublished ? '공개' : '비공개'}
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
