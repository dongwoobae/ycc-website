'use client'

import { useEffect, useRef, useState } from 'react'
import { drainSseEvents } from '@/lib/sse'
import type { GenerateThumbnailResult, ThumbnailGenProgress } from '@/lib/thumbnails/generate'
import type { ThumbnailStyle } from '@/lib/thumbnails/types'

// 서버 maxDuration(300s) 직후를 덮는 backstop. 보통은 스트림 close로 먼저 끝난다.
const GEN_TIMEOUT_MS = 330_000

export function useThumbnailGenerate() {
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState<ThumbnailGenProgress | null>(null)
  const lockRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  // 언마운트 시 진행 중 요청 정리(누수 방지).
  useEffect(() => () => abortRef.current?.abort(), [])

  /**
   * 배경 생성을 SSE로 스트리밍하며 진행률을 갱신하고, 완료 시 결과를 반환한다.
   * 실패하면 throw하므로 호출부에서 메시지를 처리한다.
   */
  async function generate(sermonId: string, style: ThumbnailStyle): Promise<GenerateThumbnailResult> {
    if (lockRef.current) throw new Error('이미 생성 중입니다.')
    lockRef.current = true
    setGenerating(true)
    setProgress({ current: 0, total: style === 'cutout' ? 4 : 3, phase: '준비 중...' })

    const controller = new AbortController()
    abortRef.current = controller
    const timeout = setTimeout(() => controller.abort(), GEN_TIMEOUT_MS)
    try {
      const res = await fetch(`/api/admin/sermons/${sermonId}/thumbnail/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) throw new Error('썸네일 생성 요청에 실패했습니다.')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let result: GenerateThumbnailResult | null = null
      let errorMsg = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const { events, rest } = drainSseEvents(buffer)
        buffer = rest
        for (const ev of events) {
          let data: Record<string, unknown>
          try {
            data = JSON.parse(ev.data)
          } catch {
            continue
          }
          if (ev.event === 'progress') setProgress(data as unknown as ThumbnailGenProgress)
          else if (ev.event === 'done') result = data as unknown as GenerateThumbnailResult
          else if (ev.event === 'error') errorMsg = String(data.message ?? '')
        }
      }

      if (errorMsg) throw new Error(errorMsg)
      if (!result) throw new Error('연결이 끊겼습니다. 다시 시도해 주세요.')
      return result
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('썸네일 생성이 시간 초과되었습니다.')
      }
      throw err
    } finally {
      clearTimeout(timeout)
      abortRef.current = null
      lockRef.current = false
      setGenerating(false)
      setProgress(null)
    }
  }

  return { generating, progress, generate }
}
