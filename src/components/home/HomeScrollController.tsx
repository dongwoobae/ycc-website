'use client'

import { useEffect } from 'react'

const SCROLL_LOCK_MS = 900
const WHEEL_IGNORE_DELTA = 6
const HERO_EXIT_THRESHOLD = 60

export default function HomeScrollController() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    let locked = false
    let unlockTimer: number | undefined

    const unlock = () => {
      locked = false
      if (unlockTimer) {
        window.clearTimeout(unlockTimer)
        unlockTimer = undefined
      }
    }

    const lock = () => {
      locked = true
      if (unlockTimer) window.clearTimeout(unlockTimer)
      unlockTimer = window.setTimeout(unlock, SCROLL_LOCK_MS)
    }

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.deltaY <= WHEEL_IGNORE_DELTA) return

      if (locked) {
        event.preventDefault()
        return
      }

      const hero = document.querySelector<HTMLElement>('[data-home-hero]')
      const nextSection = document.querySelector<HTMLElement>('[data-home-after-hero]')
      if (!hero || !nextSection) return

      const heroRect = hero.getBoundingClientRect()
      const isLeavingHero = heroRect.top <= HERO_EXIT_THRESHOLD && heroRect.bottom > window.innerHeight * 0.55
      if (!isLeavingHero) return

      event.preventDefault()
      lock()
      nextSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    window.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      window.removeEventListener('wheel', onWheel)
      if (unlockTimer) window.clearTimeout(unlockTimer)
    }
  }, [])

  return null
}
