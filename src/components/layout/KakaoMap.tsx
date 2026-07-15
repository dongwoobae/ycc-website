'use client'

import { useEffect, useRef, useState } from 'react'
import { churchInfo } from '@/lib/church'

const GOOGLE_SRC = `https://www.google.com/maps?q=${encodeURIComponent(churchInfo.address)}&output=embed`

export default function KakaoMap() {
  const [failed, setFailed] = useState(false)
  const okRef = useRef(false)

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data === 'kakaomap-ok') okRef.current = true
      else if (e.data === 'kakaomap-fail') setFailed(true)
    }
    window.addEventListener('message', onMessage)
    // 4초 내 성공 신호 없으면 구글맵으로 폴백
    const timer = setTimeout(() => {
      if (!okRef.current) setFailed(true)
    }, 4000)
    return () => {
      window.removeEventListener('message', onMessage)
      clearTimeout(timer)
    }
  }, [])

  return (
    <iframe
      src={failed ? GOOGLE_SRC : '/map.html'}
      title={`${churchInfo.name} 위치 지도`}
      loading="lazy"
      className="block h-[340px] w-full sm:h-[400px]"
      style={{ border: 0 }}
    />
  )
}
