import Link from 'next/link'
import type { ReactNode } from 'react'

export function HomeButton({
  href,
  children,
  variant = 'accent',
}: {
  href: string
  children: ReactNode
  variant?: 'accent' | 'ghost' | 'light'
}) {
  const classes = {
    accent:
      'bg-accent text-white hover:-translate-y-0.5 hover:bg-accent-deep',
    ghost:
      'border-white/50 text-white hover:bg-white/10',
    light:
      'border-line bg-paper text-ink hover:-translate-y-0.5 hover:border-accent',
  }

  return (
    <Link
      href={href}
      className={`motion-hover inline-flex items-center justify-center rounded-full border px-7 py-4 text-sm font-bold transition sm:text-base ${classes[variant]}`}
    >
      {children}
    </Link>
  )
}

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-[12.5px] font-bold uppercase tracking-[0.28em] text-accent ${className}`}>{children}</p>
}

export function ImagePlaceholder({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div
      className={`relative h-full min-h-full overflow-hidden bg-[linear-gradient(135deg,rgb(var(--surface)),rgb(var(--paper))_54%,rgb(var(--line)))] ${className}`}
      aria-label={label}
      role="img"
    >
      {/* TODO: 실제 교회 사진으로 교체 */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgb(var(--accent)/0.22),transparent_34%),linear-gradient(160deg,rgb(var(--accent-deep)/0.22),transparent_60%)]" />
      <div className="absolute bottom-5 left-5 right-5 text-xs font-semibold leading-5 text-ink-muted/80">{label}</div>
    </div>
  )
}
