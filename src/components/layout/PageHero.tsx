import Container from './Container'
import Reveal from '@/components/ui/Reveal'

/**
 * 페이지 히어로 - 단색 배경 3종(PDF 수정요청: 사진·그라디언트 전면 제거).
 * navy(소개·소식·처음), royal(행복선언·설교·찬양), beige(예배 시간).
 */
const HERO_TONES = {
  navy: {
    section: 'bg-accent-deep text-white',
    eyebrow: 'text-gold',
    subtitle: 'text-white/[0.82]',
  },
  royal: {
    section: 'bg-accent text-white',
    eyebrow: 'text-gold-soft',
    subtitle: 'text-white/85',
  },
  beige: {
    section: 'bg-beige text-ink',
    eyebrow: 'text-gold-deep',
    subtitle: 'text-ink-muted',
  },
} as const

export type HeroTone = keyof typeof HERO_TONES

interface PageHeroProps {
  eyebrow?: string
  title: string
  subtitle?: string
  /** 페이지별 히어로 색. 기본은 딥 네이비. */
  tone?: HeroTone
}

export default function PageHero({ eyebrow, title, subtitle, tone = 'navy' }: PageHeroProps) {
  const colors = HERO_TONES[tone]
  return (
    <section className={`${colors.section}`}>
      <Container size="wide" className="py-16 sm:py-[4.5rem]">
        <Reveal variant="fade">
          {eyebrow && (
            <p className={`text-sm font-extrabold uppercase tracking-[0.3em] ${colors.eyebrow}`}>{eyebrow}</p>
          )}
        </Reveal>
        <Reveal variant="fade-up" delay={100}>
          <h1 className="mt-3.5 text-4xl font-extrabold leading-tight tracking-tight sm:text-[58px]">
            {title}
          </h1>
        </Reveal>
        {subtitle && (
          <Reveal variant="fade-up" delay={220}>
            <p className={`mt-4 max-w-2xl text-lg leading-7 sm:text-[19px] ${colors.subtitle}`}>{subtitle}</p>
          </Reveal>
        )}
      </Container>
    </section>
  )
}
