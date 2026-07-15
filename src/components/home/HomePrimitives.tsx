import Link from 'next/link'
import type { ReactNode } from 'react'

export function HomeButton({
  href,
  children,
  variant = 'primary',
}: {
  href: string
  children: ReactNode
  variant?: 'primary' | 'outline' | 'white' | 'ghost'
}) {
  const classes = {
    primary: 'border-transparent bg-accent-deep text-white hover:bg-accent',
    outline: 'border-[1.5px] border-accent-deep text-accent-deep hover:bg-accent-deep/[0.06]',
    white: 'border-transparent bg-white text-accent-deep hover:bg-gold hover:text-[#1D1503]',
    ghost: 'border-[1.5px] border-white/50 text-white hover:bg-white/10',
  }

  return (
    <Link
      href={href}
      className={`motion-hover inline-flex items-center justify-center rounded-full border px-7 py-4 text-base font-extrabold transition ${classes[variant]}`}
    >
      {children}
    </Link>
  )
}

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-[13.5px] font-extrabold uppercase tracking-[0.28em] text-gold-deep ${className}`}>{children}</p>
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
