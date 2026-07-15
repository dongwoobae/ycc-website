import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'
import { HomeButton } from './HomePrimitives'

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
            영천중앙교회
          </h1>
        </Reveal>
        <Reveal delay={220}>
          <div className="mx-auto mt-9 h-1 w-16 bg-gold" aria-hidden />
        </Reveal>
        <Reveal delay={300}>
          <p className="mx-auto mt-7 max-w-[640px] break-keep text-[clamp(16px,2vw,21px)] font-medium leading-[1.7] text-ink-muted">
            오래된 믿음 위에, 새로운 은혜가 머무는 곳.
            <br />
            주일 오전 11시, 본당에서 함께 예배합니다.
          </p>
        </Reveal>
        <Reveal delay={380}>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <HomeButton href="/worship">예배 시간 안내</HomeButton>
            <HomeButton href="/newfamily#visit" variant="outline">
              오시는 길
            </HomeButton>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
