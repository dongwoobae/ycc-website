import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import PostForm from '@/components/admin/PostForm'
import { updatePost, type PostFormInput } from '@/lib/actions/posts'
import { isScheduled } from '@/lib/data/posts'
import { db } from '@/lib/db'
import { posts } from '@/lib/db/schema'
import { verifySession } from '@/lib/dal'
import { formatKstDateTimeInput } from '@/lib/date'
import type { PostCategory } from '@/lib/types'

interface EditPostPageProps {
  params: Promise<{ id: string }>
}

export default async function EditPostPage({ params }: EditPostPageProps) {
  await verifySession()

  const { id } = await params
  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1)
  if (!post) notFound()

  const initialValue: PostFormInput = {
    title: post.title,
    content: post.content ?? '',
    category: post.category as PostCategory,
    isPinned: post.isPinned,
    isPublished: post.isPublished,
    // 예약 상태(게시 시각이 미래)일 때만 전달 — 폼이 이 값으로 '예약 게시' 모드를 복원한다.
    // 이미 게시된 글은 null → 수정 저장해도 서버가 기존 게시 시각을 유지한다.
    publishedAt: post.publishedAt && isScheduled(post) ? formatKstDateTimeInput(post.publishedAt) : null,
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">소식/공지 관리</p>
          <h1 className="mt-1 text-xl font-bold text-ink">게시글 수정</h1>
        </div>
        <Link
          href="/admin/posts"
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface"
        >
          목록
        </Link>
      </div>
      <PostForm submitLabel="변경 저장" initialValue={initialValue} submitAction={updatePost.bind(null, id)} />
    </div>
  )
}
