import Link from 'next/link'
import PostForm from '@/components/admin/PostForm'
import { createPost } from '@/lib/actions/posts'
import { verifySession } from '@/lib/dal'

export default async function NewPostPage() {
  await verifySession()

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">소식/공지 관리</p>
          <h1 className="mt-1 text-xl font-bold text-ink">새 게시글</h1>
        </div>
        <Link
          href="/admin/posts"
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface"
        >
          목록
        </Link>
      </div>
      <PostForm submitLabel="게시글 작성" submitAction={createPost} />
    </div>
  )
}
