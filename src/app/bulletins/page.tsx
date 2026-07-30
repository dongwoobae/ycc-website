import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import Container from '@/components/layout/Container'
import BulletinsHero from '@/components/bulletins/BulletinsHero'
import NewsSubnav from '@/components/news/NewsSubnav'
import Reveal from '@/components/ui/Reveal'
import { getBulletins } from '@/lib/data/bulletins'
import { formatBulletinDate, formatIssueLabel } from '@/lib/bulletin-format'
import { churchInfo } from '@/lib/church'
import type { Bulletin } from '@/lib/types'

export const metadata: Metadata = {
  title: '주보',
  description: `${churchInfo.name} 주보를 온라인으로 열람할 수 있습니다.`,
  alternates: {
    canonical: '/bulletins',
  },
}

export const revalidate = 3600

export default async function BulletinsPage() {
  const bulletins = await getBulletins()
  const [latest, ...rest] = bulletins

  return (
    <>
      <BulletinsHero />
      <NewsSubnav />
      <div className="py-16 sm:py-20">
        <Container size="wide">
          {latest ? (
            <Reveal variant="fade-up">
              <FeaturedBulletin bulletin={latest} />
            </Reveal>
          ) : (
            <p className="rounded-2xl border border-line bg-paper p-10 text-center text-ink-muted">
              등록된 주보가 아직 없습니다.
            </p>
          )}

          {rest.length > 0 ? (
            <Reveal variant="fade-up" delay={100}>
              <section className="mt-10">
                <h2 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gold-deep">지난 주보</h2>
                <ul className="mt-3 divide-y divide-line-soft border-t border-line">
                  {rest.map((bulletin) => (
                    <li key={bulletin.id}>
                      <Link
                        href={`/bulletins/${bulletin.id}`}
                        className="flex items-baseline justify-between gap-4 py-3.5 transition hover:opacity-70"
                      >
                        <span className="shrink-0 text-[13px] text-faint">
                          {formatBulletinDate(bulletin.bulletinDate)}
                        </span>
                        <span className="min-w-0 truncate text-right text-sm font-bold text-ink">
                          {bulletin.sermonTitle || '주보 보기'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>
          ) : null}
        </Container>
      </div>
    </>
  )
}

/** 교인 대부분은 이번 주 주보만 본다. 최신 것에 시선을 집중시킨다. */
function FeaturedBulletin({ bulletin }: { bulletin: Bulletin }) {
  const cover = bulletin.pages[0]
  const issueLabel = formatIssueLabel(bulletin.volume, bulletin.issue)

  return (
    <Link
      href={`/bulletins/${bulletin.id}`}
      className="group grid gap-5 rounded-2xl bg-gradient-to-br from-[#0B1F5C] to-[#071540] p-6 text-white shadow-lifted transition hover:-translate-y-0.5 sm:grid-cols-[140px_1fr] sm:p-8"
    >
      <div className="overflow-hidden rounded-lg bg-white">
        {cover ? (
          <Image
            src={cover.previewUrl}
            alt={`${formatBulletinDate(bulletin.bulletinDate)} 주보 표지`}
            width={cover.width}
            height={cover.height}
            unoptimized
            className="h-auto w-full"
          />
        ) : (
          <div className="flex aspect-[1/1.414] items-center justify-center text-line-strong">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-gold-soft">이번 주 주보</p>
        {bulletin.sermonTitle ? (
          <h2 className="mt-2.5 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
            {bulletin.sermonTitle}
          </h2>
        ) : null}
        <p className="mt-2.5 text-sm text-[#B9C4DE]">
          {[formatBulletinDate(bulletin.bulletinDate), issueLabel, bulletin.scripture].filter(Boolean).join(' · ')}
        </p>
        <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-extrabold text-gold-soft">
          주보 보기 →
        </span>
      </div>
    </Link>
  )
}
