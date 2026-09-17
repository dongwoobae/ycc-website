import { describe, expect, it, vi, beforeEach } from 'vitest'

const callOrder: string[] = []
const create = vi.fn(async () => {
  callOrder.push('create')
  return { scheduleId: 'x' }
})
const list = vi.fn(async () => [] as { scheduleId: string }[])
const del = vi.fn(async (id: string) => {
  callOrder.push(`delete:${id}`)
})

vi.mock('@upstash/qstash', () => ({
  Client: class {
    schedules = { create, list, delete: del }
  },
  Receiver: class {},
}))

import { syncSchedules } from './qstash'

beforeEach(() => {
  vi.clearAllMocks()
  callOrder.length = 0
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

    const result = await syncSchedules(
      [{ job: 'reconcile-sermons', cron: '0 0 * * *', scheduleId: 'ycc-reconcile-sermons' }],
      true,
    )

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

    await syncSchedules(
      [{ job: 'reconcile-sermons', cron: '0 0 * * *', scheduleId: 'ycc-reconcile-sermons' }],
      true,
    )

    expect(del).not.toHaveBeenCalled()
  })

  it('desired가 비면 거부하고 아무것도 지우지 않는다', async () => {
    list.mockResolvedValue([{ scheduleId: 'ycc-reconcile-sermons' }])

    await expect(syncSchedules([], true)).rejects.toThrow()

    expect(create).not.toHaveBeenCalled()
    expect(del).not.toHaveBeenCalled()
  })

  it('접두사 없는 desired ID는 거부하고 아무것도 만들거나 지우지 않는다', async () => {
    list.mockResolvedValue([])

    await expect(
      syncSchedules([{ job: 'reconcile-sermons', cron: '0 0 * * *', scheduleId: 'not-managed' }], true),
    ).rejects.toThrow()

    expect(create).not.toHaveBeenCalled()
    expect(del).not.toHaveBeenCalled()
  })

  it('desired 전체를 create한다', async () => {
    list.mockResolvedValue([])

    await syncSchedules(
      [
        { job: 'reconcile-sermons', cron: '0 0 * * *', scheduleId: 'ycc-a' },
        { job: 'reconcile-sermons', cron: '0 2-8 * * 0', scheduleId: 'ycc-b' },
        { job: 'analytics-rollup', cron: '10 15 * * *', scheduleId: 'ycc-c' },
      ],
      true,
    )

    expect(create).toHaveBeenCalledTimes(3)
  })

  it('create가 전부 끝난 뒤에 delete가 일어난다', async () => {
    list.mockResolvedValue([{ scheduleId: 'ycc-a' }, { scheduleId: 'ycc-stale' }])

    await syncSchedules(
      [
        { job: 'reconcile-sermons', cron: '0 0 * * *', scheduleId: 'ycc-a' },
        { job: 'analytics-rollup', cron: '10 15 * * *', scheduleId: 'ycc-b' },
      ],
      true,
    )

    const lastCreateIndex = callOrder.lastIndexOf('create')
    const firstDeleteIndex = callOrder.findIndex((c) => c.startsWith('delete:'))
    expect(firstDeleteIndex).toBeGreaterThan(lastCreateIndex)
  })

  it('list()가 실패하면 delete는 0건이다', async () => {
    list.mockRejectedValue(new Error('list 실패'))

    await expect(
      syncSchedules([{ job: 'reconcile-sermons', cron: '0 0 * * *', scheduleId: 'ycc-a' }], true),
    ).rejects.toThrow('list 실패')

    expect(del).not.toHaveBeenCalled()
  })

  it('apply가 false면 create는 하되 삭제는 건너뛰고 후보만 돌려준다', async () => {
    list.mockResolvedValue([{ scheduleId: 'ycc-a' }, { scheduleId: 'ycc-stale' }])

    const result = await syncSchedules(
      [{ job: 'reconcile-sermons', cron: '0 0 * * *', scheduleId: 'ycc-a' }],
      false,
    )

    expect(create).toHaveBeenCalledTimes(1)
    expect(del).not.toHaveBeenCalled()
    expect(result.deleted).toEqual([])
    expect(result.staleManaged).toEqual(['ycc-stale'])
  })
})
