interface SectionTitleProps {
  eyebrow?: string
  title: string
  description?: string
  align?: 'left' | 'center'
}

export default function SectionTitle({
  eyebrow,
  title,
  description,
  align = 'left',
}: SectionTitleProps) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      {eyebrow && <p className="mb-3 text-sm font-semibold text-accent-deep">{eyebrow}</p>}
      <h2 className="font-serif text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 leading-7 text-ink-muted">{description}</p>}
    </div>
  )
}
