import { adultWorshipSchedule } from '@/lib/worship'

// 주보마다 바뀌지 않는 고정 일정이라 worship.ts 에서 그대로 가져온다.
// 관리자가 매주 다시 입력할 이유가 없다.
const shown = ['주일예배', '찬양예배', '수요예배'] as const

export default function BulletinWorshipTimes() {
  const items = shown
    .map((name) => adultWorshipSchedule.find((item) => item.name === name))
    .filter((item): item is (typeof adultWorshipSchedule)[number] => Boolean(item))

  return (
    <section className="rounded-2xl bg-beige p-6">
      <h2 className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-gold-deep">예배 시간</h2>
      <dl className="mt-3 divide-y divide-ink/10">
        {items.map((item) => (
          <div key={item.name} className="flex items-baseline justify-between gap-4 py-2 text-sm">
            <dt className="font-bold text-ink">{item.name}</dt>
            <dd className="text-ink-muted">
              {item.time} · {item.place}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
