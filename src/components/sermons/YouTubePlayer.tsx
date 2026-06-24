'use client'

import { useEffect, useRef, type MutableRefObject } from 'react'

interface Props {
  youtubeId: string
  title: string
  seekToRef?: MutableRefObject<((seconds: number) => void) | null>
  rootRef?: MutableRefObject<HTMLDivElement | null>
  /** 영상이 한 번이라도 재생/일시정지/버퍼링 상태가 되면 호출 (사용자 진입 감지) */
  onEngaged?: () => void
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

export default function YouTubePlayer({ youtubeId, title, seekToRef, rootRef, onEngaged }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const onEngagedRef = useRef(onEngaged)

  useEffect(() => {
    onEngagedRef.current = onEngaged
  }, [onEngaged])

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
        events: {
          onStateChange: (event: { data: number }) => {
            // 1=재생, 2=일시정지, 3=버퍼링 → 사용자가 영상에 진입한 것으로 간주
            if (event.data === 1 || event.data === 2 || event.data === 3) onEngagedRef.current?.()
          },
        },
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
    <div ref={rootRef} className="overflow-hidden rounded-lg border border-line bg-surface shadow-subtle">
      <div className="aspect-video w-full" aria-label={title}>
        <div ref={hostRef} className="h-full w-full" />
      </div>
    </div>
  )
}
