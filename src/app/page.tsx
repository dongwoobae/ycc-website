import Link from 'next/link'
import SermonCard from '@/components/sermons/SermonCard'
import PostCard from '@/components/posts/PostCard'

// TODO: Supabase fetch로 교체
const LATEST_SERMON = {
  id: 'sample-1',
  title: '하나님의 사랑 (샘플)',
  preacher: '홍길동 목사',
  scripture: '요한복음 3:16',
  worshipType: '주일예배',
  sermonDate: '2025-01-05',
}

const SAMPLE_POSTS = [
  { id: 'p1', title: '2025년 1월 교회 소식', category: '소식', publishedAt: '2025-01-03', isPinned: true },
  { id: 'p2', title: '신년 예배 일정 안내', category: '공지', publishedAt: '2025-01-01', isPinned: false },
  { id: 'p3', title: '2025년 1월 1일자 주보', category: '주보', publishedAt: '2025-01-01', isPinned: false },
]

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-12 px-4 py-10">
      <section className="rounded-2xl bg-white py-16 text-center shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900">영천중앙교회</h1>
        <p className="mt-3 text-gray-500">말씀과 사랑으로 세상을 섬깁니다</p>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">최신 설교</h2>
          <Link href="/sermons" className="text-sm text-blue-600 hover:underline">
            더 보기 →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <SermonCard {...LATEST_SERMON} />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">소식 &amp; 공지</h2>
          <Link href="/news" className="text-sm text-blue-600 hover:underline">
            더 보기 →
          </Link>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          {SAMPLE_POSTS.map((post) => (
            <PostCard key={post.id} {...post} />
          ))}
        </div>
      </section>
    </div>
  )
}
