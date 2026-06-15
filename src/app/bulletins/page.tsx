import type { Metadata } from 'next'
import Link from 'next/link'
import Container from '@/components/layout/Container'
import PageHero from '@/components/layout/PageHero'
import Reveal from '@/components/ui/Reveal'
import { getBulletins } from '@/lib/seed/bulletins'

export const metadata: Metadata = {
  title: '주보',
}

export default async function BulletinsPage() {
  const bulletins = await getBulletins()

  return (
    <>
      <PageHero
        eyebrow="Bulletin"
        title="주보"
        subtitle="매주 예배 순서와 교회 소식을 정리해 제공합니다."
        image="https://images.unsplash.com/photo-1490127252417-7c393f993ee4?auto=format&fit=crop&w=1600&q=80"
      />
      <div className="py-16">
        <Container>
          <div className="grid gap-6 md:grid-cols-2">
            {bulletins.map((bulletin, i) => (
              <Reveal key={bulletin.id} variant="fade-up" delay={(i % 2) * 100}>
                <Link
                  href={`/bulletins/${bulletin.id}`}
                  className="block h-full rounded-lg border border-line bg-paper p-6 shadow-subtle transition hover:-translate-y-1 hover:shadow-soft"
                >
                  <p className="text-sm font-semibold text-accent">
                    {bulletin.volume} {bulletin.issue}
                  </p>
                  <h2 className="mt-3 font-serif text-3xl text-ink">{bulletin.bulletinDate} 주보</h2>
                  <p className="mt-4 text-ink-muted">{bulletin.theme}</p>
                  <p className="mt-2 text-sm text-ink-muted">({bulletin.scripture})</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </Container>
      </div>
    </>
  )
}
