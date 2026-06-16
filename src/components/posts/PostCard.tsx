import Link from 'next/link'
import type { Post } from '@/lib/types'

export default function PostCard({ post }: { post: Post }) {
  return (
    <Link
      href={`/news/${post.id}`}
      className="grid gap-3 border-b border-line py-5 last:border-b-0 sm:grid-cols-[auto_1fr_auto] sm:items-center"
    >
      <span className="w-fit rounded-full bg-surface px-3 py-1 text-xs font-semibold text-accent-deep">
        {post.category}
      </span>
      <div>
        <h3 className="font-medium text-ink transition hover:text-accent-deep">
          {post.isPinned && <span className="mr-2 text-accent-deep">고정</span>}
          {post.title}
        </h3>
        <p className="mt-1 line-clamp-1 text-sm text-ink-muted">{post.content}</p>
      </div>
      <time className="text-sm text-ink-muted" dateTime={post.publishedAt}>
        {post.publishedAt}
      </time>
    </Link>
  )
}
