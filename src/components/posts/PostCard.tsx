import Link from 'next/link'

interface PostCardProps {
  id: string
  title: string
  category: string
  publishedAt: string
  isPinned?: boolean
}

export default function PostCard({ id, title, category, publishedAt, isPinned }: PostCardProps) {
  return (
    <Link
      href={`/news/${id}`}
      className="flex items-center justify-between rounded border-b border-gray-100 px-2 py-3 transition hover:bg-gray-50"
    >
      <div className="flex items-center gap-3">
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{category}</span>
        {isPinned && <span className="text-xs font-medium text-red-500">📌</span>}
        <span className="line-clamp-1 text-sm text-gray-800">{title}</span>
      </div>
      <span className="ml-4 shrink-0 text-xs text-gray-400">{publishedAt}</span>
    </Link>
  )
}
