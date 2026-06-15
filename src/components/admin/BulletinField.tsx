'use client'

interface BulletinFieldProps {
  id: string
  label: string
  value?: string
  type?: string
  required?: boolean
  onChange: (value: string) => void
}

export default function BulletinField({ id, label, value = '', type = 'text', required, onChange }: BulletinFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
      />
    </div>
  )
}
