'use client'

import { ListInput } from './BulletinSectionText'
import type { BulletinOffering } from '@/lib/types'

export default function BulletinOfferingsEditor({
  offerings,
  onChange,
}: {
  offerings: BulletinOffering[]
  onChange: (offerings: BulletinOffering[]) => void
}) {
  function update(index: number, patch: Partial<BulletinOffering>) {
    onChange(offerings.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium text-ink">헌금</h4>
        <button type="button" onClick={() => onChange([...offerings, { category: '', names: [] }])} className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink">
          헌금 추가
        </button>
      </div>
      {offerings.map((offering, index) => (
        <div key={index} className="space-y-3 rounded-lg border border-line bg-bg p-4">
          <input value={offering.category} onChange={(event) => update(index, { category: event.target.value })} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent" placeholder="분류" />
          <ListInput label="이름" value={offering.names} onChange={(names) => update(index, { names })} />
          <button type="button" onClick={() => onChange(offerings.filter((_, i) => i !== index))} className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-muted">
            삭제
          </button>
        </div>
      ))}
    </div>
  )
}
