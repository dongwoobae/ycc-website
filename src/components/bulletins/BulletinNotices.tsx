import type { BulletinNotice } from '@/lib/types'

/**
 * 「이번 주 일정 · 공지」 통합 리스트.
 *
 * 특별일정과 공지를 한 배열로 합친 이유: 따로 두면 특별일정이 2개 이상일 때
 * 카드 그리드가 깨진다. when 유무로 배지만 갈리는 단일 리스트면 개수에 무관하게 렌더된다.
 */
export default function BulletinNotices({ notices }: { notices: BulletinNotice[] }) {
  if (notices.length === 0) return null

  return (
    <section className="rounded-2xl border border-line bg-paper p-6">
      <h2 className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-gold-deep">
        이번 주 일정 · 공지
      </h2>
      <ul className="mt-3 divide-y divide-line-soft">
        {notices.map((notice, index) => (
          <li key={`${notice.title}-${index}`} className="flex gap-3 py-2.5">
            <span
              className={
                notice.when
                  ? 'h-fit shrink-0 rounded-md bg-[#0B1F5C] px-2 py-1 text-[10px] font-extrabold text-gold-soft'
                  : 'h-fit shrink-0 rounded-md bg-line-soft px-2 py-1 text-[10px] font-extrabold text-faint'
              }
            >
              {notice.when || '공지'}
            </span>
            <div className="min-w-0">
              {notice.title ? <h3 className="text-sm font-extrabold text-ink">{notice.title}</h3> : null}
              {notice.detail ? <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{notice.detail}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
