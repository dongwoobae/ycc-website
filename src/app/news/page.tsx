import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import PageHero from '@/components/layout/PageHero'
import Reveal from '@/components/ui/Reveal'
import PostCard from '@/components/posts/PostCard'
import { getPosts } from '@/lib/data/posts'

export const metadata: Metadata = {
  title: '교회소식',
}

export default async function NewsPage() {
  const posts = await getPosts()

  return (
    <>
      <PageHero
        eyebrow="News"
        title="교회소식"
        subtitle="공지와 행사, 공동체 소식을 전합니다."
        image="https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=1600&q=80"
      />
      <div className="py-16">
        <Container className="max-w-4xl">
          <div className="rounded-lg border border-line bg-paper p-6 shadow-subtle">
            {posts.map((post, i) => (
              <Reveal key={post.id} variant="left" delay={i * 70}>
                <PostCard post={post} />
              </Reveal>
            ))}
          </div>
        </Container>
      </div>
    </>
  )
}
