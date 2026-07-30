'use client'

import BulletinField from './BulletinField'
import type { BulletinFormInput } from '@/lib/actions/bulletins'

interface BulletinGlanceFieldsProps {
  form: BulletinFormInput
  onChange: (patch: Partial<BulletinFormInput>) => void
}

export default function BulletinGlanceFields({ form, onChange }: BulletinGlanceFieldsProps) {
  return (
    <div className="grid gap-4 rounded-xl bg-paper p-6 shadow-sm md:grid-cols-2">
      <BulletinField
        id="bulletinDate"
        label="주보일"
        type="date"
        value={form.bulletinDate}
        required
        onChange={(bulletinDate) => onChange({ bulletinDate })}
      />
      <BulletinField id="preacher" label="설교자" value={form.preacher} onChange={(preacher) => onChange({ preacher })} />
      <BulletinField id="volume" label="권" value={form.volume} onChange={(volume) => onChange({ volume })} />
      <BulletinField id="issue" label="호" value={form.issue} onChange={(issue) => onChange({ issue })} />
      <div className="md:col-span-2">
        <BulletinField
          id="sermonTitle"
          label="설교 제목"
          value={form.sermonTitle}
          onChange={(sermonTitle) => onChange({ sermonTitle })}
        />
      </div>
      <div className="md:col-span-2">
        <BulletinField
          id="scripture"
          label="설교 본문"
          value={form.scripture}
          onChange={(scripture) => onChange({ scripture })}
        />
      </div>
      <BulletinField
        id="hymns"
        label="찬송가 (예: 새 210장 · 통 40장)"
        value={form.hymns}
        onChange={(hymns) => onChange({ hymns })}
      />
      <BulletinField
        id="responsiveReading"
        label="교독문"
        value={form.responsiveReading}
        onChange={(responsiveReading) => onChange({ responsiveReading })}
      />
      <div className="md:col-span-2">
        <BulletinField
          id="nextWeek"
          label="다음 주 예고 (한 줄, 비우면 표시되지 않음)"
          value={form.nextWeek}
          onChange={(nextWeek) => onChange({ nextWeek })}
        />
      </div>
    </div>
  )
}
