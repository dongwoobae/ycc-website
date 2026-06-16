import Image from 'next/image'
import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'
import { Eyebrow, HomeButton } from './HomePrimitives'

export default function ImmersiveHero() {
  return (
    <section className="relative isolate flex min-h-[620px] h-[100svh] items-end overflow-hidden bg-[linear-gradient(160deg,oklch(0.32_0.07_256),oklch(0.2_0.05_260))] text-white">
      <Image
        src="/images/church-hero.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="ken-burns -z-20 object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,oklch(0.15_0.05_258/.45)_0%,transparent_28%,oklch(0.14_0.05_258/.55)_70%,oklch(0.13_0.055_258/.94)_100%)]" />
      <Container size="wide" className="pb-24 pt-32 min-[960px]:px-10 min-[960px]:pb-28">
        <Reveal>
          <Eyebrow>영천, 그리고 우리</Eyebrow>
        </Reveal>
        <Reveal delay={120}>
          <h1 className="mt-6 text-[clamp(48px,9vw,118px)] font-extrabold leading-[1.02] tracking-tight text-white [text-shadow:0_4px_50px_oklch(0.1_0.05_258/.6)]">
            이 도시에서,
            <br />
            <span className="text-accent">함께</span> 걷습니다.
          </h1>
        </Reveal>
        <Reveal delay={240}>
          <p className="mt-7 max-w-[44ch] text-[clamp(17px,2vw,22px)] font-medium leading-8 text-white/90">
            바쁜 일상 속 잠시 멈추어 숨을 고르고, 영천에서 살아가는 우리의 이야기가 시작되는 자리입니다.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <div className="mt-10 flex flex-wrap gap-3">
            <HomeButton href="/newfamily">교회가 처음이세요? →</HomeButton>
            <HomeButton href="/#visit" variant="ghost">
              예배시간 · 오시는 길
            </HomeButton>
          </div>
        </Reveal>
      </Container>
      <div className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60 sm:flex">
        <span>SCROLL</span>
        <span className="scroll-cue-line h-10 w-px origin-top bg-gradient-to-b from-white/70 to-transparent [animation:scroll-cue_2s_ease-in-out_infinite]" />
      </div>
    </section>
  )
}
