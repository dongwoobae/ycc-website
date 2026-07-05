import Image from 'next/image'
import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'
import { HomeButton } from './HomePrimitives'

// 홈 스크롤 #3 — 교회 소개 + 바로가기. 글자 가독성을 위해 교회 사진을 더 흐리게.
export default function FullBleedBand() {
  return (
    <section className="relative isolate flex min-h-[560px] h-[82svh] items-center overflow-hidden bg-[oklch(0.2_0.05_259)] text-white">
      <Image
        src="/images/church-spire.webp"
        alt=""
        fill
        unoptimized
        sizes="100vw"
        className="-z-20 scale-110 object-cover object-[center_28%] blur-[3px]"
      />
      <div className="absolute inset-0 -z-10 bg-black/35" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,oklch(0.12_0.05_258/.9)_0%,oklch(0.12_0.05_258/.6)_60%,oklch(0.12_0.05_258/.35)_100%)]" />
      <Container size="wide" className="min-[960px]:px-10">
        <Reveal className="max-w-2xl">
          <h2 className="text-[clamp(24px,3.4vw,42px)] font-extrabold leading-[1.32] tracking-tight">
            대한예수교장로회 영천중앙교회는
            <br />
            예수 그리스도의 복음 위에 세워진 <span className="text-accent">믿음의 공동체</span>입니다.
          </h2>
          <p className="mt-5 text-[clamp(15px,1.6vw,19px)] leading-8 text-white/90">
            우리는 예배와 말씀 위에 서서, 기도로 하나님의 통치를 구하며,
            <br className="hidden sm:block" />
            이웃과 다음 세대를 섬김으로 하나님 나라가 이루어지기를 갈망합니다.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <HomeButton href="/worship">예배 시간</HomeButton>
            <HomeButton href="/newfamily#visit" variant="ghost">
              오시는 길
            </HomeButton>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
