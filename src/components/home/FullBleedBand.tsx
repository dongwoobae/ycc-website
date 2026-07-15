import Image from 'next/image'
import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'
import { HomeButton } from './HomePrimitives'

// 홈 #3 — 소개 밴드. 배경 사진·블러 제거 → 단색 딥 네이비 + 골드 포인트 (PDF).
export default function FullBleedBand() {
  return (
    <section className="bg-accent-deep py-24 text-white min-[960px]:py-28">
      <Container size="wide" className="grid items-center gap-12 min-[960px]:grid-cols-[1.1fr_0.9fr] min-[960px]:gap-16">
        <Reveal>
          <p className="text-[13.5px] font-extrabold uppercase tracking-[0.28em] text-gold">About</p>
          <h2 className="mt-5 text-[clamp(26px,3.4vw,42px)] font-extrabold leading-[1.4] tracking-tight">
            예수 그리스도의 복음 위에 세워진
            <br />
            <span className="text-gold">믿음의 공동체</span>입니다
          </h2>
          <p className="mt-6 max-w-xl text-[clamp(15px,1.6vw,18px)] leading-[1.85] text-white/85">
            대한예수교장로회 영천중앙교회는 예배와 말씀 위에 서서, 기도로 하나님의 통치를 구하며,
            이웃과 다음 세대를 섬김으로 하나님 나라가 이루어지기를 갈망합니다.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <HomeButton href="/about" variant="white">
              교회 소개
            </HomeButton>
            <HomeButton href="/about/greeting" variant="ghost">
              담임목사 인사
            </HomeButton>
          </div>
        </Reveal>
        <Reveal delay={140}>
          <div className="relative h-[320px] overflow-hidden rounded-2xl shadow-[0_28px_60px_rgb(0_0_0/0.35)] min-[960px]:h-[420px]">
            <Image
              src="/images/church-spire.webp"
              alt="영천중앙교회 전경"
              fill
              unoptimized
              sizes="(min-width: 960px) 45vw, 100vw"
              className="object-cover object-[center_28%]"
            />
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
