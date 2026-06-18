import Link from 'next/link'
import type { Post } from '@/lib/types'

const chipStyles: Record<Post['category'], string> = {
  공지: 'bg-accent/12 text-accent-deep',
  소식: 'bg-accent/12 text-accent-deep',
  행사: 'bg-emerald-100 text-emerald-700',
}

export default function PostCard({ post }: { post: Post }) {
  return (
    <Link
      href={`/news/${post.id}`}
      className="block border-b border-line py-7 transition-[padding] duration-200 first:pt-0 last:border-b-0 last:pb-0 hover:pl-2"
    >
      <div className="flex items-center gap-3">
        {post.isPinned && (
          <span className="whitespace-nowrap rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white">고정</span>
        )}
        <span className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${chipStyles[post.category]}`}>
          {post.category}
        </span>
        <time className="whitespace-nowrap text-[13.5px] font-semibold text-faint" dateTime={post.publishedAt}>
          {post.publishedAt}
        </time>
      </div>
      <h2 className="mt-3.5 font-serif text-2xl font-extrabold leading-snug tracking-tight text-ink">{post.title}</h2>
      <p className="mt-2.5 line-clamp-2 leading-7 text-ink-muted">{post.content}</p>
      <span className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-accent-deep">
        자세히 보기 →
      </span>
    </Link>
  )
}
