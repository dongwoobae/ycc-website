import Link from 'next/link'
import Container from '@/components/layout/Container'
import SectionTitle from '@/components/ui/SectionTitle'
import Reveal from '@/components/ui/Reveal'
import SermonCard from '@/components/sermons/SermonCard'
import PostCard from '@/components/posts/PostCard'
import { getLatestSermons } from '@/lib/seed/sermons'
import { getLatestBulletin } from '@/lib/seed/bulletins'
import { getLatestPosts } from '@/lib/seed/posts'

export default async function HomePage() {
  const [sermons, bulletin, posts] = await Promise.all([
    getLatestSermons(3),
    getLatestBulletin(),
    getLatestPosts(3),
  ])

  return (
    <div>
      <section className="border-b border-line bg-surface">
        <Container className="grid min-h-[calc(100vh-4.5rem)] items-center gap-10 py-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <Reveal>
              <p className="text-sm font-semibold text-accent">대한예수교장로회</p>
            </Reveal>
            <Reveal delay={120}>
              <h1 className="mt-5 font-serif text-5xl leading-tight text-ink sm:text-6xl">
                삶의 소망을 주는 은혜로운 영천중앙교회
              </h1>
            </Reveal>
            <Reveal delay={240}>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-muted">
                구역이 살아나고 지역 사회를 섬기는 교회. 말씀과 예배, 따뜻한 공동체로
                영천의 이웃을 섬깁니다.
              </p>
            </Reveal>
            <Reveal delay={360}>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/about/visit" className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-bg transition hover:bg-accent-deep">
                  예배시간 보기
                </Link>
                <Link
                  href="/sermons"
                  className="rounded-full border border-line bg-paper px-6 py-3 text-sm font-semibold text-ink transition hover:bg-surface"
                >
                  설교 보기
                </Link>
              </div>
            </Reveal>
          </div>
          <Reveal delay={200} className="overflow-hidden rounded-lg border border-line bg-paper shadow-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=1400&q=80"
              alt="따뜻한 빛이 들어오는 예배당"
              className="h-full min-h-[28rem] w-full object-cover"
            />
          </Reveal>
        </Container>
      </section>

      <section className="py-20">
        <Container>
          <Reveal>
            <div className="mb-8 flex items-end justify-between gap-4">
              <SectionTitle eyebrow="Worship" title="최근 설교" description="말씀을 다시 듣고 묵상할 수 있습니다." />
              <Link href="/sermons" className="hidden text-sm font-semibold text-accent sm:block">
                전체 보기
              </Link>
            </div>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-3">
            {sermons.map((sermon, i) => (
              <Reveal key={sermon.id} delay={i * 100}>
                <SermonCard sermon={sermon} />
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-y border-line bg-surface py-20">
        <Container className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <SectionTitle
              eyebrow="Sunday Bulletin"
              title="이번 주 주보"
              description="예배 순서와 교회 소식을 모바일에서도 읽기 편하게 정리했습니다."
            />
          </Reveal>
          {bulletin && (
            <Reveal delay={120}>
              <Link
                href={`/bulletins/${bulletin.id}`}
                className="block rounded-lg border border-line bg-paper p-8 shadow-subtle transition hover:-translate-y-1 hover:shadow-soft"
              >
                <p className="text-sm font-semibold text-accent">
                  {bulletin.volume} {bulletin.issue}
                </p>
                <h3 className="mt-3 font-serif text-3xl text-ink">{bulletin.bulletinDate} 주보</h3>
                <p className="mt-4 text-ink-muted">{bulletin.theme}</p>
                <p className="mt-2 text-sm text-ink-muted">({bulletin.scripture})</p>
              </Link>
            </Reveal>
          )}
        </Container>
      </section>

      <section className="py-20">
        <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <SectionTitle eyebrow="Schedule" title="예배 시간" />
            <dl className="mt-8 grid gap-4">
              {[
                ['주일예배', '주일 오전 11시'],
                ['찬양예배', '주일 오후 2시'],
                ['수요예배', '수요일 오후 7시 30분'],
                ['새벽기도', '화-주일 오전 5시'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-line pb-3">
                  <dt className="font-semibold text-ink">{label}</dt>
                  <dd className="text-ink-muted">{value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
          <Reveal delay={120} className="rounded-lg border border-line bg-paper p-6 shadow-subtle">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-serif text-2xl text-ink">교회소식</h2>
              <Link href="/news" className="text-sm font-semibold text-accent">
                더 보기
              </Link>
            </div>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </Reveal>
        </Container>
      </section>
    </div>
  )
}
