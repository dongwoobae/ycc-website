import Container from './Container'
import Reveal from '@/components/ui/Reveal'
import HeroBackdrop from './HeroBackdrop'

/**
 * 페이지(섹션)별 히어로 톤 — 채도 낮은 파스텔로 명도·톤을 통일해 사이트가 하나로 묶이되
 * 섹션마다 다른 색 정체성을 갖게 한다. 본문(중립)·푸터(네이비)와도 구분됨.
 */
const HERO_TONES = {
  about: 'linear-gradient(135deg, rgb(220 231 247), rgb(228 227 244))', // 소프트 블루-라벤더
  worship: 'linear-gradient(135deg, rgb(242 236 220), rgb(233 222 198))', // 웜 샌드
  sermons: 'linear-gradient(135deg, rgb(225 226 243), rgb(210 216 239))', // 더스티 페리윙클
  praise: 'linear-gradient(135deg, rgb(245 236 222), rgb(240 224 205))', // 웜 골드 (찬양)
  newfamily: 'linear-gradient(135deg, rgb(246 231 231), rgb(240 218 220))', // 웜 로즈
  news: 'linear-gradient(135deg, rgb(226 238 230), rgb(209 228 216))', // 세이지 그린
  bulletins: 'linear-gradient(135deg, rgb(228 234 240), rgb(213 223 233))', // 슬레이트
  gallery: 'linear-gradient(135deg, rgb(235 228 242), rgb(223 211 238))', // 라벤더-플럼
} as const

export type HeroTone = keyof typeof HERO_TONES

interface PageHeroProps {
  eyebrow?: string
  title: string
  subtitle?: string
  image?: string
  /** 페이지별 히어로 색. 기본은 소개(블루-라벤더). */
  tone?: HeroTone
}

export default function PageHero({ eyebrow, title, subtitle, image, tone = 'about' }: PageHeroProps) {
  const gradient = HERO_TONES[tone]
  return (
    <section className="relative isolate overflow-hidden" style={{ backgroundImage: gradient }}>
      <HeroBackdrop image={image} gradient={gradient} />
      <Container className="flex min-h-[18rem] flex-col justify-center py-16 md:min-h-[22rem]">
        <Reveal variant="fade">
          {eyebrow && (
            <p className="text-[12.5px] font-bold uppercase tracking-[0.28em] text-accent">{eyebrow}</p>
          )}
        </Reveal>
        <Reveal variant="fade-up" delay={100}>
          <h1 className="mt-3 font-serif text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
            {title}
          </h1>
        </Reveal>
        {subtitle && (
          <Reveal variant="fade-up" delay={220}>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-muted">{subtitle}</p>
          </Reveal>
        )}
      </Container>
    </section>
  )
}
