import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Container from '@/components/layout/Container'
import { getPostById } from '@/lib/data/posts'

interface NewsDetailProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: NewsDetailProps): Promise<Metadata> {
  const { id } = await params
  const post = await getPostById(id)
  if (!post) return { title: '교회소식' }
  return {
    title: post.title,
    description: post.content,
  }
}

export default async function NewsDetailPage({ params }: NewsDetailProps) {
  const { id } = await params
  const post = await getPostById(id)
  if (!post) notFound()

  return (
    <div className="py-16">
      <Container className="max-w-3xl">
        <p className="text-sm font-semibold text-accent-deep">
          {post.category} · {post.publishedAt}
        </p>
        <h1 className="mt-3 font-serif text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
          {post.title}
        </h1>
        <article className="mt-10 rounded-lg border border-line bg-paper p-8 text-lg leading-9 text-ink-muted shadow-subtle">
          {post.content}
        </article>
      </Container>
    </div>
  )
}
