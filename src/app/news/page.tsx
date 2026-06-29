import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import PageHero from '@/components/layout/PageHero'
import NewsSubnav from '@/components/news/NewsSubnav'
import Reveal from '@/components/ui/Reveal'
import PostCard from '@/components/posts/PostCard'
import { getPosts } from '@/lib/data/posts'

export const metadata: Metadata = {
  title: '교회소식',
}

export const revalidate = 3600

export default async function NewsPage() {
  const posts = await getPosts()

  return (
    <>
      <PageHero
        eyebrow="News"
        title="교회소식"
        subtitle="공지와 행사, 공동체 소식을 전합니다."
        image="https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1600&q=80"
      />
      <NewsSubnav />
      <div className="py-20 sm:py-24">
        <Container className="max-w-3xl">
          <div className="rounded-2xl border border-line bg-paper p-8 shadow-subtle sm:p-11">
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
