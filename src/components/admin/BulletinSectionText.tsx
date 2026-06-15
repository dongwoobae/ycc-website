'use client'

export function BodyEditor({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-ink">본문</label>
      <textarea
        value={value.join('\n')}
        onChange={(event) => onChange(event.target.value.split('\n'))}
        className="min-h-48 w-full resize-y rounded-lg border border-line bg-bg px-4 py-3 text-sm leading-7 text-ink outline-none transition focus:border-accent"
      />
    </div>
  )
}

export function ListInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string[]
  onChange: (value: string[]) => void
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-medium text-ink-muted">{label}</label>
      <textarea
        value={value.join('\n')}
        onChange={(event) => onChange(event.target.value.split('\n'))}
        className="min-h-24 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-accent"
      />
    </div>
  )
}
