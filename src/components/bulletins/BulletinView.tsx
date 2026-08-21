import Link from 'next/link'
import BulletinGlance from './BulletinGlance'
import BulletinNotices from './BulletinNotices'
import BulletinPageViewer from './BulletinPageViewer'
import BulletinWorshipTimes from './BulletinWorshipTimes'
import { formatBulletinDate } from '@/lib/bulletin-format'
import type { BulletinNeighbor } from '@/lib/data/bulletins'
import type { Bulletin } from '@/lib/types'

interface BulletinViewProps {
  bulletin: Bulletin
  previous?: BulletinNeighbor
  next?: BulletinNeighbor
}

export default function BulletinView({ bulletin, previous, next }: BulletinViewProps) {
  return (
    <article>
      {/* 데스크탑은 좌(한눈에 정보) / 우(원본) 2단, 모바일은 단일 열 */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
        <div className="space-y-5">
          <BulletinGlance bulletin={bulletin} />
          <BulletinWorshipTimes />
          <BulletinNotices notices={bulletin.notices} />
          {bulletin.nextWeek ? (
            <section className="rounded-2xl border border-dashed border-line bg-surface p-5">
              <h2 className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-gold-deep">다음 주 예고</h2>
              <p className="mt-2 text-sm text-ink-muted">{bulletin.nextWeek}</p>
            </section>
          ) : null}
        </div>
        <BulletinPageViewer pages={bulletin.pages} bulletinDate={bulletin.bulletinDate} pdfUrl={bulletin.pdfUrl} />
      </div>

      <nav className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5 text-sm">
        {previous ? (
          <Link href={`/bulletins/${previous.id}`} className="font-bold text-accent-deep transition hover:opacity-70">
            ← {formatBulletinDate(previous.bulletinDate)} 주보
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/bulletins/${next.id}`} className="font-bold text-accent-deep transition hover:opacity-70">
            {formatBulletinDate(next.bulletinDate)} 주보 →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  )
}
