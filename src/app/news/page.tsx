import { Fragment } from 'react'
import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import NewsHero from '@/components/news/NewsHero'
import NewsSubnav from '@/components/news/NewsSubnav'
import Reveal from '@/components/ui/Reveal'
import PostCard from '@/components/posts/PostCard'
import { getPosts } from '@/lib/data/posts'
import type { Post } from '@/lib/types'
import { churchInfo } from '@/lib/church'

export const metadata: Metadata = {
  title: '교회소식',
  description: `${churchInfo.name}의 새로운 소식과 공지사항을 전합니다.`,
  alternates: {
    canonical: '/news',
  },
}

export const revalidate = 3600

function PostSection({ posts, delayOffset = 0 }: { posts: Post[]; delayOffset?: number }) {
  return (
    <div className="space-y-4 rounded-2xl border border-line bg-paper p-8 shadow-subtle sm:p-11">
      {posts.map((post, i) => (
        <Fragment key={post.id}>
          {i > 0 && <hr className="border-line" />}
          <Reveal variant="left" delay={(delayOffset + i) * 70}>
            <PostCard post={post} />
          </Reveal>
        </Fragment>
      ))}
    </div>
  )
}

export default async function NewsPage() {
  const posts = await getPosts()
  const pinned = posts.filter((post) => post.isPinned)
  const rest = posts.filter((post) => !post.isPinned)

  return (
    <>
      <NewsHero />
      <NewsSubnav />
      <div className="py-20 sm:py-24">
        <Container className="max-w-3xl space-y-8">
          {pinned.length > 0 && <PostSection posts={pinned} />}
          {rest.length > 0 && <PostSection posts={rest} delayOffset={pinned.length} />}
        </Container>
      </div>
    </>
  )
}
