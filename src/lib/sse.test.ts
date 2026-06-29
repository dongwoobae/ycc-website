import { describe, expect, it } from 'vitest'
import { formatSse, drainSseEvents } from './sse'

describe('formatSse', () => {
  it('event/data 줄과 빈 줄 종료로 직렬화한다', () => {
    expect(formatSse('progress', { current: 1, total: 3 })).toBe(
      'event: progress\ndata: {"current":1,"total":3}\n\n',
    )
  })
})

describe('drainSseEvents', () => {
  it('완성된 이벤트만 파싱하고 미완성 나머지는 rest로 남긴다', () => {
    const { events, rest } = drainSseEvents('event: progress\ndata: {"current":1}\n\nevent: done\ndata: {')
    expect(events).toEqual([{ event: 'progress', data: '{"current":1}' }])
    expect(rest).toBe('event: done\ndata: {')
  })

  it('주석(heartbeat) 라인은 무시한다', () => {
    const { events } = drainSseEvents(': ping\n\nevent: done\ndata: {"inserted":0}\n\n')
    expect(events).toEqual([{ event: 'done', data: '{"inserted":0}' }])
  })

  it('data가 없는 이벤트는 건너뛴다', () => {
    const { events } = drainSseEvents('event: noop\n\n')
    expect(events).toEqual([])
  })

  it('여러 data 라인은 개행으로 합친다', () => {
    const { events } = drainSseEvents('event: x\ndata: a\ndata: b\n\n')
    expect(events).toEqual([{ event: 'x', data: 'a\nb' }])
  })
})
