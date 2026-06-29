/** Server-Sent Events 한 메시지를 `event:`/`data:` + 빈 줄 종료로 직렬화한다. */
export function formatSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export interface SseEvent {
  event: string
  data: string
}

/**
 * 누적 버퍼에서 완성된 SSE 이벤트들을 뽑아내고, 끝의 미완성 조각은 rest로 돌려준다.
 * - `\n\n`(또는 `\r\n\r\n`)로 이벤트 경계 분할
 * - `:`로 시작하는 주석/heartbeat 라인 무시
 * - 여러 `data:` 라인은 개행으로 합침 (SSE 스펙)
 * - `data`가 하나도 없는 이벤트는 제외
 */
export function drainSseEvents(buffer: string): { events: SseEvent[]; rest: string } {
  const parts = buffer.split(/\r?\n\r?\n/)
  const rest = parts.pop() ?? ''
  const events: SseEvent[] = []
  for (const raw of parts) {
    if (!raw.trim()) continue
    let event = ''
    const dataLines: string[] = []
    for (const line of raw.split(/\r?\n/)) {
      if (line.startsWith(':')) continue
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
    }
    if (dataLines.length === 0) continue
    events.push({ event, data: dataLines.join('\n') })
  }
  return { events, rest }
}
