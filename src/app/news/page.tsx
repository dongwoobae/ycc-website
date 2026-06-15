import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import SectionTitle from '@/components/ui/SectionTitle'
import PostCard from '@/components/posts/PostCard'
import { getPosts } from '@/lib/seed/posts'

export const metadata: Metadata = {
  title: '교회소식',
}

export default async function NewsPage() {
  const posts = await getPosts()

  return (
    <div className="py-16">
      <Container className="max-w-4xl">
        <SectionTitle eyebrow="News" title="교회소식" description="공지와 행사, 공동체 소식을 전합니다." />
        <div className="mt-10 rounded-lg border border-line bg-paper p-6 shadow-subtle">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </Container>
    </div>
  )
}
