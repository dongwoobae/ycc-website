import Image from 'next/image'
import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'

export default function ImmersiveHero() {
  return (
    <section data-home-hero className="relative isolate flex min-h-[620px] h-[100svh] items-end overflow-hidden bg-[linear-gradient(160deg,oklch(0.32_0.07_256),oklch(0.2_0.05_260))] text-white">
      <Image
        src="/images/church-hero-still.webp"
        alt=""
        fill
        priority
        unoptimized
        sizes="100vw"
        className="-z-20 object-cover object-[center_30%]"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,oklch(0.15_0.05_258/.30)_0%,transparent_32%,oklch(0.14_0.05_258/.30)_66%,oklch(0.13_0.055_258/.70)_100%)]" />
      <Container size="wide" className="pb-24 pt-32 min-[960px]:px-10 min-[960px]:pb-28">
        <div className="min-[960px]:ml-auto min-[960px]:max-w-2xl min-[960px]:text-right">
          <Reveal delay={120}>
            <h1 className="mt-6 font-extrabold leading-[1.05] tracking-tight text-white [text-shadow:0_4px_50px_oklch(0.1_0.05_258/.6)]">
              <span className="block text-[clamp(18px,3vw,30px)] font-bold tracking-[0.14em] text-white/80">
                Welcome to
              </span>
              <span className="mt-2 block text-[clamp(46px,9vw,112px)]">영천중앙교회</span>
            </h1>
          </Reveal>
          <Reveal delay={240}>
            <p className="mt-7 max-w-[44ch] text-[clamp(17px,2vw,22px)] font-medium leading-8 text-white/90 min-[960px]:ml-auto">
              “그가 나를 푸른 풀밭에 누이시며 쉴 만한 물가로 인도하시는도다.” <br />
              <span className="text-[0.8em] font-semibold tracking-[0.1em] text-white/55">- 시편 23:2</span>
            </p>
          </Reveal>
        </div>
      </Container>
    </section>
  )
}
