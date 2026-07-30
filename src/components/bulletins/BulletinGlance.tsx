import { formatBulletinDate, formatIssueLabel } from '@/lib/bulletin-format'
import type { Bulletin } from '@/lib/types'

/**
 * 「이번 주 한눈에」 카드.
 *
 * 원본 이미지는 모바일에서 확대 없이 읽히지 않는다. 이 카드가 관리자가 직접 타이핑한
 * 텍스트로 그 공백을 메우고, 동시에 이미지 방식이 잃는 검색·스크린리더 접근성을 되살린다.
 */
export default function BulletinGlance({ bulletin }: { bulletin: Bulletin }) {
  const issueLabel = formatIssueLabel(bulletin.volume, bulletin.issue)
  const eyebrow = [formatBulletinDate(bulletin.bulletinDate), issueLabel].filter(Boolean).join(' · ')

  return (
    <section className="rounded-2xl bg-gradient-to-br from-[#0B1F5C] to-[#071540] p-7 text-white shadow-lifted sm:p-8">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-gold-soft">{eyebrow}</p>
      <span aria-hidden className="mt-3 block h-0.5 w-9 bg-gold" />
      {bulletin.sermonTitle ? (
        <h2 className="mt-4 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
          {bulletin.sermonTitle}
        </h2>
      ) : null}
      {(bulletin.scripture || bulletin.preacher) && (
        <p className="mt-3 text-sm text-[#B9C4DE]">
          {bulletin.scripture}
          {bulletin.scripture && bulletin.preacher ? ' · ' : ''}
          {bulletin.preacher ? <b className="font-bold text-gold-soft">{bulletin.preacher}</b> : null}
        </p>
      )}
      {(bulletin.hymns || bulletin.responsiveReading) && (
        <div className="mt-5 flex flex-wrap gap-2">
          {bulletin.hymns ? <Chip label="찬송" value={bulletin.hymns} /> : null}
          {bulletin.responsiveReading ? <Chip label="교독" value={bulletin.responsiveReading} /> : null}
        </div>
      )}
    </section>
  )
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-gold-soft/30 bg-white/10 px-3 py-1 text-[11px]">
      <b className="mr-1.5 font-bold text-gold-soft">{label}</b>
      {value}
    </span>
  )
}
