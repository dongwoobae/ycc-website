import Image from 'next/image'
import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'
import { HomeButton } from './HomePrimitives'

export default function FullBleedBand() {
  return (
    <section className="relative isolate flex min-h-[520px] h-[78svh] items-center overflow-hidden bg-[oklch(0.24_0.055_259)] text-white">
      <Image
        src="/images/church-spire.webp"
        alt=""
        fill
        unoptimized
        sizes="100vw"
        className="-z-20 object-cover object-[center_28%]"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,oklch(0.13_0.055_258/.84)_0%,oklch(0.13_0.055_258/.38)_60%,transparent_100%)]" />
      <Container size="wide" className="min-[960px]:px-10">
        <Reveal className="max-w-xl">
          <h2 className="text-[clamp(30px,4.6vw,58px)] font-extrabold leading-[1.08] tracking-tight">
            처음 오시는 길,
            <br />
            <span className="text-accent">혼자 두지 않습니다.</span>
          </h2>
          <p className="mt-5 text-lg leading-8 text-white/90">
            복장, 주차, 예배 순서, 아이 돌봄까지 궁금한 모든 것을 미리 안내해 드립니다. 편안한 마음으로 한 번
            오세요.
          </p>
          <div className="mt-8">
            <HomeButton href="/newfamily">처음 방문 안내 보기 →</HomeButton>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
