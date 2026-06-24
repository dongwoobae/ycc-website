import { useEffect, useRef } from 'react'

const HEADER_HEIGHT = 80
const RADIUS = 8
const DESKTOP_BREAKPOINT = 1024
const SM_BREAKPOINT = 640
const PAD_SM = 24
const PAD_BASE = 20
const EASE_MS = 200

const VIDEO_TRANSITION = `margin-left ${EASE_MS}ms ease, margin-right ${EASE_MS}ms ease`
const FRAME_TRANSITION = `border-radius ${EASE_MS}ms ease, border-left-width ${EASE_MS}ms ease, border-right-width ${EASE_MS}ms ease`

/**
 * 모바일에서 설교 영상이 스크롤에 연동돼 100vw로 펼쳐졌다 줄어드는 효과.
 * active(사용자가 영상 재생/일시정지로 진입)일 때만 동작하며, 비활성 시엔 스타일을 리셋해
 * 영상이 일반 흐름으로 스크롤되도록 둔다. active로 켜지는 순간엔 한 번만 트랜지션을 걸어
 * 도킹 지점 근처에서 눌러도 점프 없이 부드럽게 펼쳐지게 한다.
 */
export function useStickyVideoBleed(active: boolean) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    const video = videoRef.current
    const frame = frameRef.current
    if (!sentinel || !video || !frame) return

    const reset = () => {
      video.style.transition = ''
      video.style.marginLeft = ''
      video.style.marginRight = ''
      frame.style.transition = ''
      frame.style.borderRadius = ''
      frame.style.borderLeftWidth = ''
      frame.style.borderRightWidth = ''
    }

    if (!active) {
      reset()
      return
    }

    let start = 0
    let raf: number | null = null

    const measure = () => {
      start = sentinel.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT
    }

    const render = () => {
      raf = null
      if (window.innerWidth >= DESKTOP_BREAKPOINT) {
        video.style.marginLeft = ''
        video.style.marginRight = ''
        frame.style.borderRadius = ''
        frame.style.borderLeftWidth = ''
        frame.style.borderRightWidth = ''
        return
      }
      const pad = window.innerWidth >= SM_BREAKPOINT ? PAD_SM : PAD_BASE
      const p = start > 0 ? Math.min(1, Math.max(0, window.scrollY / start)) : 0
      const margin = `${-pad * p}px`
      video.style.marginLeft = margin
      video.style.marginRight = margin
      frame.style.borderRadius = `${RADIUS * (1 - p)}px`
      frame.style.borderLeftWidth = `${1 - p}px`
      frame.style.borderRightWidth = `${1 - p}px`
    }

    const onScroll = () => {
      if (raf !== null) return
      raf = requestAnimationFrame(render)
    }
    const onResize = () => {
      measure()
      render()
    }

    // 진입 순간 1회 트랜지션 → 도킹 지점에서 눌러도 점프 대신 부드럽게 펼쳐짐
    video.style.transition = VIDEO_TRANSITION
    frame.style.transition = FRAME_TRANSITION
    const easeTimer = window.setTimeout(() => {
      video.style.transition = ''
      frame.style.transition = ''
    }, EASE_MS + 20)

    measure()
    render()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      if (raf !== null) cancelAnimationFrame(raf)
      window.clearTimeout(easeTimer)
    }
  }, [active])

  return { sentinelRef, videoRef, frameRef }
}
