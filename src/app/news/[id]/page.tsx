import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Container from '@/components/layout/Container'
import NewsHero from '@/components/news/NewsHero'
import NewsSubnav from '@/components/news/NewsSubnav'
import { getPostById, getPostNeighbors, getPosts, type PostNeighbor } from '@/lib/data/posts'
import JsonLd from '@/components/seo/JsonLd'
import { buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'

export const revalidate = 3600

interface NewsDetailProps {
  params: Promise<{ id: string }>
}

export async function generateStaticParams() {
  const posts = await getPosts()
  return posts.map((post) => ({ id: post.id }))
}

function truncateDescription(value: string, maxLength = 160) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}

export async function generateMetadata({ params }: NewsDetailProps): Promise<Metadata> {
  const { id } = await params
  const post = await getPostById(id)
  if (!post) return { title: '교회소식' }
  return {
    title: post.title,
    description: truncateDescription(post.content),
    alternates: {
      canonical: `/news/${post.id}`,
    },
  }
}

function NeighborRow({ label, arrow, neighbor }: { label: string; arrow: string; neighbor?: PostNeighbor }) {
  const inner = (
    <>
      <span className="w-10 shrink-0 font-bold text-ink">{label}</span>
      <span className="shrink-0 text-ink-muted">{arrow}</span>
      <span className="min-w-0 flex-1 truncate text-ink-muted">
        {neighbor ? neighbor.title : '글이 없습니다'}
      </span>
      {neighbor && <time className="shrink-0 text-sm text-faint">{neighbor.publishedAt}</time>}
    </>
  )
  const base = 'flex items-center gap-4 px-1 py-4 sm:gap-6'
  return neighbor ? (
    <Link href={`/news/${neighbor.id}`} title={neighbor.title} className={`${base} transition hover:bg-surface/60`}>
      {inner}
    </Link>
  ) : (
    <div className={`${base} opacity-50`}>{inner}</div>
  )
}

export default async function NewsDetailPage({ params }: NewsDetailProps) {
  const { id } = await params
  const post = await getPostById(id)
  if (!post) notFound()
  const { prev, next } = await getPostNeighbors(id)

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: '홈', path: '/' },
          { name: '소식', path: '/news' },
          { name: post.title, path: `/news/${post.id}` },
        ])}
      />
      <NewsHero />
      <NewsSubnav />
      <div className="py-16">
        <Container className="max-w-3xl">
          <p className="text-sm font-semibold text-accent-deep">{post.category}</p>
          <h1 className="mt-3 font-serif text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
            {post.title}
          </h1>
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-1.5 border-y border-line py-4 text-sm text-ink-muted">
            <div className="flex gap-2">
              <dt className="font-semibold text-ink">작성일</dt>
              <dd>{post.publishedAt}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-semibold text-ink">작성자</dt>
              <dd>{post.author ?? '영천중앙교회'}</dd>
            </div>
          </dl>
          <article className="mt-8 min-h-[40vh] whitespace-pre-line rounded-lg border border-line bg-paper p-8 text-lg leading-9 text-ink-muted shadow-subtle">
            {post.content}
          </article>
          <nav className="mt-12 divide-y divide-line border-y border-line">
            <NeighborRow label="이전" arrow="<" neighbor={prev} />
            <NeighborRow label="다음" arrow=">" neighbor={next} />
          </nav>
          <div className="mt-6 flex justify-end">
            <Link
              href="/news"
              className="rounded-md bg-accent-deep px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              목록으로
            </Link>
          </div>
        </Container>
      </div>
    </>
  )
}
