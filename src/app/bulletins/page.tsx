import type { Metadata } from 'next'
import Link from 'next/link'
import Container from '@/components/layout/Container'
import SectionTitle from '@/components/ui/SectionTitle'
import { getBulletins } from '@/lib/seed/bulletins'

export const metadata: Metadata = {
  title: '주보',
}

export default async function BulletinsPage() {
  const bulletins = await getBulletins()

  return (
    <div className="py-16">
      <Container>
        <SectionTitle eyebrow="Bulletin" title="주보" description="매주 예배 순서와 교회 소식을 정리해 제공합니다." />
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {bulletins.map((bulletin) => (
            <Link
              key={bulletin.id}
              href={`/bulletins/${bulletin.id}`}
              className="rounded-lg border border-line bg-paper p-6 shadow-subtle transition hover:-translate-y-1 hover:shadow-soft"
            >
              <p className="text-sm font-semibold text-accent">
                {bulletin.volume} {bulletin.issue}
              </p>
              <h2 className="mt-3 font-serif text-3xl text-ink">{bulletin.bulletinDate} 주보</h2>
              <p className="mt-4 text-ink-muted">{bulletin.theme}</p>
              <p className="mt-2 text-sm text-ink-muted">({bulletin.scripture})</p>
            </Link>
          ))}
        </div>
      </Container>
    </div>
  )
}
