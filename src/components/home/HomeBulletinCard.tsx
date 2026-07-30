import Image from 'next/image'
import Link from 'next/link'
import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'
import { formatBulletinDate, formatIssueLabel } from '@/lib/bulletin-format'
import type { Bulletin } from '@/lib/types'

/**
 * 홈의 「이번 주 한눈에」 축약판. 카드 전체가 상세로 가는 링크다.
 * 교인이 홈만 열어도 이번 주 설교와 날짜가 보이게 한다.
 */
export default function HomeBulletinCard({ bulletin }: { bulletin: Bulletin }) {
  const cover = bulletin.pages[0]
  const meta = [formatBulletinDate(bulletin.bulletinDate), formatIssueLabel(bulletin.volume, bulletin.issue)]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="bg-surface py-16 sm:py-20">
      <Container size="wide">
        <Reveal variant="fade-up">
          <Link
            href={`/bulletins/${bulletin.id}`}
            className="group grid gap-5 rounded-2xl bg-gradient-to-br from-[#0B1F5C] to-[#071540] p-6 text-white shadow-lifted transition hover:-translate-y-0.5 sm:grid-cols-[112px_1fr] sm:p-8"
          >
            {cover ? (
              <div className="overflow-hidden rounded-lg bg-white">
                <Image
                  src={cover.previewUrl}
                  alt={`${formatBulletinDate(bulletin.bulletinDate)} 주보 표지`}
                  width={cover.width}
                  height={cover.height}
                  unoptimized
                  className="h-auto w-full"
                />
              </div>
            ) : null}
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-gold-soft">이번 주 주보</p>
              {bulletin.sermonTitle ? (
                <h2 className="mt-2.5 text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">
                  {bulletin.sermonTitle}
                </h2>
              ) : null}
              {(bulletin.scripture || bulletin.preacher) && (
                <p className="mt-2 text-sm text-[#B9C4DE]">
                  {[bulletin.scripture, bulletin.preacher].filter(Boolean).join(' · ')}
                </p>
              )}
              <p className="mt-1 text-xs text-[#8A94AC]">{meta}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-extrabold text-gold-soft">
                주보 보기 →
              </span>
            </div>
          </Link>
        </Reveal>
      </Container>
    </section>
  )
}
