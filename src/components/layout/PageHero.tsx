import Container from './Container'
import Reveal from '@/components/ui/Reveal'
import HeroBackdrop from './HeroBackdrop'

/**
 * 페이지(섹션)별 히어로 톤 — 채도 낮은 파스텔로 명도·톤을 통일해 사이트가 하나로 묶이되
 * 섹션마다 다른 색 정체성을 갖게 한다. 본문(중립)·푸터(네이비)와도 구분됨.
 */
// 본문(거의 흰색, rgb(250 249 246))과 명확히 구분되도록 한 단계 진한 파스텔.
// 채도 낮은 톤을 유지해 사이트 정체성은 지키되, 히어로가 밋밋하게 배경에 묻히지 않게 함.
const HERO_TONES = {
  about: 'linear-gradient(135deg, rgb(203 221 246), rgb(214 211 238))', // 소프트 블루-라벤더
  worship: 'linear-gradient(135deg, rgb(235 224 197), rgb(224 207 172))', // 웜 샌드
  sermons: 'linear-gradient(135deg, rgb(210 214 240), rgb(190 199 232))', // 더스티 페리윙클
  praise: 'linear-gradient(135deg, rgb(240 224 197), rgb(232 207 174))', // 웜 골드 (찬양)
  newfamily: 'linear-gradient(135deg, rgb(242 219 219), rgb(233 200 203))', // 웜 로즈
  news: 'linear-gradient(135deg, rgb(210 231 217), rgb(190 217 200))', // 세이지 그린
  bulletins: 'linear-gradient(135deg, rgb(214 225 236), rgb(196 210 227))', // 슬레이트
  gallery: 'linear-gradient(135deg, rgb(226 214 238), rgb(210 191 231))', // 라벤더-플럼
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
    <section
      className="relative isolate overflow-hidden border-b border-black/5"
      style={{ backgroundImage: gradient }}
    >
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
