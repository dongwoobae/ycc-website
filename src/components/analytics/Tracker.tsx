'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { isTrackablePath } from '@/lib/analytics/paths'

const HEARTBEAT_MS = 60 * 1000
const MAX_SECONDS = 2 * 60 * 60

interface ActiveView {
  id: string
  path: string
  visibleSince: number | null
  accumulatedMs: number
  stopped: boolean
}

function currentSeconds(view: ActiveView, now = Date.now()): number {
  const visibleMs = view.visibleSince === null ? 0 : now - view.visibleSince
  return Math.min(MAX_SECONDS, Math.floor((view.accumulatedMs + visibleMs) / 1000))
}

function post(payload: unknown) {
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined)
}

function beacon(payload: unknown): boolean {
  if (!navigator.sendBeacon) return false
  return navigator.sendBeacon('/api/track', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
}

export default function Tracker() {
  const pathname = usePathname()
  const viewRef = useRef<ActiveView | null>(null)

  useEffect(() => {
    if (!pathname || !isTrackablePath(pathname)) return

    const stop = (final = false) => {
      const view = viewRef.current
      if (!view || view.stopped) return
      const now = Date.now()
      if (view.visibleSince !== null) {
        view.accumulatedMs += now - view.visibleSince
        view.visibleSince = null
      }
      view.stopped = true
      const payload = { type: 'leave', viewId: view.id, path: view.path, seconds: currentSeconds(view, now) }
      if (final && beacon(payload)) return
      post(payload)
    }

    stop()

    const view: ActiveView = {
      id: crypto.randomUUID(),
      path: pathname,
      visibleSince: document.visibilityState === 'visible' ? Date.now() : null,
      accumulatedMs: 0,
      stopped: false,
    }
    viewRef.current = view
    post({ type: 'pageview', viewId: view.id, path: pathname, referrer: document.referrer || null })

    const checkpoint = () => {
      if (view.stopped || document.visibilityState !== 'visible') return
      post({ type: 'heartbeat', viewId: view.id, path: view.path, seconds: currentSeconds(view) })
    }
    const interval = window.setInterval(checkpoint, HEARTBEAT_MS)

    const onVisibilityChange = () => {
      const now = Date.now()
      if (document.visibilityState === 'hidden') {
        if (view.visibleSince !== null) {
          view.accumulatedMs += now - view.visibleSince
          view.visibleSince = null
        }
        post({ type: 'heartbeat', viewId: view.id, path: view.path, seconds: currentSeconds(view, now) })
        return
      }
      if (view.accumulatedMs / 1000 < MAX_SECONDS) view.visibleSince = now
    }

    const onPageHide = () => stop(true)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
      stop()
    }
  }, [pathname])

  return null
}
