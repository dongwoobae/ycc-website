import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'
import { churchInfo } from '@/lib/church'

// 홈 #1 — PDF 수정요청: Welcome to + 교회명만 남김(태그라인·버튼 제거).
export default function ImmersiveHero() {
  return (
    <section className="relative isolate flex min-h-[620px] h-[100svh] items-center overflow-hidden bg-beige text-ink">
      <Container size="wide" className="text-center">
        <Reveal delay={60}>
          <p className="text-[clamp(13px,1.6vw,16px)] font-extrabold uppercase tracking-[0.3em] text-gold-deep">
            Welcome to
          </p>
        </Reveal>
        <Reveal delay={140}>
          <h1 className="mt-5 text-[clamp(46px,9vw,104px)] font-extrabold leading-[1.08] tracking-[-0.01em] text-accent-deep">
            {churchInfo.name}
          </h1>
        </Reveal>
        <Reveal delay={220}>
          <div className="mx-auto mt-9 h-1 w-16 bg-gold" aria-hidden />
        </Reveal>
      </Container>
    </section>
  )
}
