'use client'

import { useEffect, useRef, type MutableRefObject } from 'react'

interface Props {
  youtubeId: string
  title: string
  seekToRef?: MutableRefObject<((seconds: number) => void) | null>
}

type YouTubePlayerInstance = {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  playVideo: () => void
}

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, opts: Record<string, unknown>) => YouTubePlayerInstance
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

function loadApi(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT?.Player) return resolve()
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve()
    }
    if (!document.getElementById('yt-iframe-api')) {
      const script = document.createElement('script')
      script.id = 'yt-iframe-api'
      script.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(script)
    }
  })
}

export default function YouTubePlayer({ youtubeId, title, seekToRef }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let player: YouTubePlayerInstance | null = null
    let cancelled = false

    loadApi().then(() => {
      if (cancelled || !hostRef.current || !window.YT) return
      player = new window.YT.Player(hostRef.current, {
        width: '100%',
        height: '100%',
        videoId: youtubeId,
        playerVars: { rel: 0 },
      })
      if (seekToRef) {
        seekToRef.current = (seconds: number) => {
          player?.seekTo(seconds, true)
          player?.playVideo()
        }
      }
    })

    return () => {
      cancelled = true
      if (seekToRef) seekToRef.current = null
    }
  }, [youtubeId, seekToRef])

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-subtle">
      <div className="aspect-video w-full" aria-label={title}>
        <div ref={hostRef} className="h-full w-full" />
      </div>
    </div>
  )
}
