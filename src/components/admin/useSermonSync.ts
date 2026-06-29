'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { drainSseEvents } from '@/lib/sse'

export type SyncPhase = 'idle' | 'confirm' | 'progress' | 'done'

export interface SyncProgressState {
  current: number
  total: number
  title: string
  phase: string
}

// 서버 maxDuration(300s) 직후를 덮는 backstop. 보통은 스트림 close로 먼저 끝난다.
const SYNC_TIMEOUT_MS = 330_000
const INITIAL: SyncProgressState = { current: 0, total: 0, title: '', phase: '' }

export function useSermonSync() {
  const router = useRouter()
  const [phase, setPhase] = useState<SyncPhase>('idle')
  const [progress, setProgress] = useState<SyncProgressState>(INITIAL)
  const [doneMsg, setDoneMsg] = useState('')
  const lockRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  // 언마운트 시 진행 중 요청 정리(누수 방지).
  useEffect(() => () => abortRef.current?.abort(), [])

  function open() {
    setProgress(INITIAL)
    setDoneMsg('')
    setPhase('confirm')
  }

  function close() {
    if (phase === 'progress') return // 진행 중엔 닫기 차단
    const wasDone = phase === 'done'
    setPhase('idle')
    if (wasDone) router.refresh() // 관리자 표 갱신
  }

  function applyEvent(event: string, dataStr: string): boolean {
    let data: Record<string, unknown>
    try {
      data = JSON.parse(dataStr)
    } catch {
      return false // 깨진 이벤트 건너뜀
    }
    if (event === 'progress') {
      setProgress(data as unknown as SyncProgressState)
      return false
    }
    if (event === 'done') {
      const inserted = Number(data.inserted ?? 0)
      const summarized = Number(data.summarized ?? 0)
      setDoneMsg(
        inserted === 0
          ? '추가된 새 영상이 없습니다.'
          : `동기화 완료: ${inserted}건 추가${summarized ? `, ${summarized}건 요약` : ''}`,
      )
      setPhase('done')
      return true
    }
    if (event === 'error') {
      setDoneMsg(`동기화 실패: ${String(data.message ?? '')}`)
      setPhase('done')
      return true
    }
    return false
  }

  async function start() {
    if (lockRef.current) return
    lockRef.current = true
    setPhase('progress')
    setProgress({ ...INITIAL, phase: '영상 목록 확인 중...' })

    const controller = new AbortController()
    abortRef.current = controller
    const timeout = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS)
    try {
      const res = await fetch('/api/admin/sermons/sync/stream', { method: 'POST', signal: controller.signal })
      if (!res.ok || !res.body) throw new Error()

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let completed = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const { events, rest } = drainSseEvents(buffer)
        buffer = rest
        for (const ev of events) {
          if (applyEvent(ev.event, ev.data)) completed = true
        }
      }

      if (!completed) {
        setDoneMsg('연결이 끊겼습니다. 일부만 처리됐을 수 있으니 다시 실행해 주세요.')
        setPhase('done')
      }
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError'
      setDoneMsg(isAbort ? '동기화 요청이 시간 초과되었습니다.' : '동기화에 실패했습니다.')
      setPhase('done')
    } finally {
      clearTimeout(timeout)
      abortRef.current = null
      lockRef.current = false
    }
  }

  return { phase, progress, doneMsg, open, start, close }
}
