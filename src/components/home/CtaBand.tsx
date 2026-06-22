import Image from 'next/image'
import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'
import { churchInfo } from '@/lib/church'
import { HomeButton } from './HomePrimitives'

export default function CtaBand() {
  return (
    <section className="relative isolate overflow-hidden bg-[oklch(0.22_0.05_259)] py-28 text-center text-white min-[960px]:py-[150px]">
      <Image
        src="/images/church-cta.jpg"
        alt=""
        fill
        sizes="100vw"
        className="-z-20 object-cover object-[center_32%]"
      />
      <div className="absolute inset-0 -z-10 bg-[oklch(0.14_0.055_258/.82)]" />
      <Container size="wide">
        <Reveal>
          <h2 className="text-[clamp(32px,5.4vw,68px)] font-extrabold leading-[1.08] tracking-tight">
            이번 주일,
            <br />
            <span className="text-accent">함께 예배드려요.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-[44ch] text-lg leading-8 text-white/90">
            처음 오시는 길, 예배 시간과 자리까지 함께하겠습니다.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <HomeButton href="/newfamily">처음 방문 안내</HomeButton>
            <HomeButton href={`tel:${churchInfo.phone}`} variant="ghost">
              전화 문의
            </HomeButton>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
