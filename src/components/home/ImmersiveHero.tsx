'use client'

import { useState, useSyncExternalStore } from 'react'
import Image from 'next/image'
import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'
import { Eyebrow } from './HomePrimitives'

const DESKTOP_QUERY = '(min-width: 960px)'
const REDUCE_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function subscribeMedia(onChange: () => void) {
  const queries = [window.matchMedia(DESKTOP_QUERY), window.matchMedia(REDUCE_MOTION_QUERY)]
  queries.forEach((q) => q.addEventListener('change', onChange))
  return () => queries.forEach((q) => q.removeEventListener('change', onChange))
}

// 데스크톱 + 모션 허용일 때만 입장 영상 재생. SSR 스냅샷은 false(=사진만).
function usePlayIntroVideo() {
  return useSyncExternalStore(
    subscribeMedia,
    () => window.matchMedia(DESKTOP_QUERY).matches && !window.matchMedia(REDUCE_MOTION_QUERY).matches,
    () => false
  )
}

export default function ImmersiveHero() {
  const showVideo = usePlayIntroVideo()
  const [videoEnded, setVideoEnded] = useState(false)

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
      {showVideo && (
        <video
          className={`absolute inset-0 -z-20 h-full w-full object-cover transition-opacity duration-1000 ease-out ${
            videoEnded ? 'opacity-0' : 'opacity-100'
          }`}
          autoPlay
          muted
          playsInline
          preload="auto"
          poster="/videos/church-hero-poster.webp"
          onEnded={() => setVideoEnded(true)}
          aria-hidden="true"
        >
          <source src="/videos/church-hero.mp4" type="video/mp4" />
        </video>
      )}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,oklch(0.15_0.05_258/.45)_0%,transparent_28%,oklch(0.14_0.05_258/.55)_70%,oklch(0.13_0.055_258/.94)_100%)]" />
      <Container size="wide" className="pb-24 pt-32 min-[960px]:px-10 min-[960px]:pb-28">
        <div className="min-[960px]:ml-auto min-[960px]:max-w-2xl min-[960px]:text-right">
          <Reveal>
            <Eyebrow>쉴 만한 물가로</Eyebrow>
          </Reveal>
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
      <div className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60 sm:flex">
        <span>SCROLL</span>
        <span className="scroll-cue-line h-10 w-px origin-top bg-gradient-to-b from-white/70 to-transparent [animation:scroll-cue_2s_ease-in-out_infinite]" />
      </div>
    </section>
  )
}
