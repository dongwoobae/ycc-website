import PostCard from '@/components/posts/PostCard'

const CATEGORIES = ['전체', '공지', '소식', '주보', '행사']

// TODO: Supabase fetch로 교체
const SAMPLE_POSTS = Array.from({ length: 8 }, (_, i) => ({
  id: `p${i + 1}`,
  title: `샘플 게시글 제목 ${i + 1}`,
  category: CATEGORIES[(i % 4) + 1],
  publishedAt: `2025-01-${String(i + 1).padStart(2, '0')}`,
  isPinned: i === 0,
}))

export default function NewsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">소식 &amp; 공지</h1>
      <div className="mb-6 flex flex-wrap gap-2">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
          >
            {category}
          </button>
        ))}
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm">
        {SAMPLE_POSTS.map((post) => (
          <PostCard key={post.id} {...post} />
        ))}
      </div>
    </div>
  )
}
