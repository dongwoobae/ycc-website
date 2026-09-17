import { describe, expect, it, vi, beforeEach } from 'vitest'

const create = vi.fn(async () => ({ scheduleId: 'x' }))
const list = vi.fn(async () => [] as { scheduleId: string }[])
const del = vi.fn(async () => undefined)

vi.mock('@upstash/qstash', () => ({
  Client: class {
    schedules = { create, list, delete: del }
  },
  Receiver: class {},
}))

import { syncSchedules } from './qstash'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('QSTASH_TOKEN', 't')
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.ycjc.kr')
})

describe('syncSchedules', () => {
  it('원하는 스케줄을 등록하고 목록에서 사라진 ycc- 스케줄은 삭제한다', async () => {
    list.mockResolvedValue([
      { scheduleId: 'ycc-reconcile-sermons' },
      { scheduleId: 'ycc-obsolete' },
      { scheduleId: 'someone-elses' },
    ])

    const result = await syncSchedules([
      { job: 'reconcile-sermons', cron: '0 0 * * *', scheduleId: 'ycc-reconcile-sermons' },
    ])

    expect(create).toHaveBeenCalledWith({
      destination: 'https://www.ycjc.kr/api/jobs/reconcile-sermons',
      cron: '0 0 * * *',
      scheduleId: 'ycc-reconcile-sermons',
    })
    expect(del).toHaveBeenCalledTimes(1)
    expect(del).toHaveBeenCalledWith('ycc-obsolete')
    expect(result.deleted).toEqual(['ycc-obsolete'])
  })

  it('우리 접두사가 아닌 스케줄은 건드리지 않는다', async () => {
    list.mockResolvedValue([{ scheduleId: 'someone-elses' }])

    await syncSchedules([])

    expect(del).not.toHaveBeenCalled()
  })
})
