'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'

/**
 * full-bleed hero 배경: Ken Burns(자동 줌, CSS) + 스크롤 parallax.
 * parallax는 좁은 화면(<md)·prefers-reduced-motion에서 자동 비활성 → jank/접근성 대응.
 * 부모 <section>은 relative + overflow-hidden 이어야 함.
 */
export default function HeroBackdrop({ image, gradient }: { image?: string; gradient?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!image) return undefined

    const el = ref.current
    if (!el) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const wide = window.matchMedia('(min-width: 768px)')
    let raf = 0

    const apply = () => {
      raf = 0
      const section = el.parentElement
      if (!section) return
      // hero가 위로 스크롤될수록 top은 음수 → 이미지를 그 일부만큼 아래로 당겨 lag(깊이감)
      const top = section.getBoundingClientRect().top
      el.style.transform = `translate3d(0, ${(-top * 0.3).toFixed(1)}px, 0)`
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply)
    }
    const update = () => {
      if (!reduce.matches && wide.matches) {
        window.addEventListener('scroll', onScroll, { passive: true })
        apply()
      } else {
        window.removeEventListener('scroll', onScroll)
        if (raf) {
          cancelAnimationFrame(raf)
          raf = 0
        }
        el.style.transform = ''
      }
    }

    update()
    reduce.addEventListener('change', update)
    wide.addEventListener('change', update)
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
      reduce.removeEventListener('change', update)
      wide.removeEventListener('change', update)
    }
  }, [image])

  return (
    <>
      <div ref={ref} className="absolute inset-0 -z-20 will-change-transform">
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            sizes="100vw"
            className="ken-burns !absolute !left-0 !top-[-35%] !h-[170%] w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{ backgroundImage: gradient ?? 'linear-gradient(135deg,rgb(220 231 247),rgb(228 227 244))' }}
          />
        )}
      </div>
      {/* 톤 중립 레이어: 좌상단 화이트 시닌(가독성) + 하단은 본문색으로 자연스럽게 페이드 */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_22%_16%,rgb(255_255_255/0.5),transparent_42%),linear-gradient(180deg,transparent_52%,rgb(var(--bg)/0.55))]" />
    </>
  )
}
