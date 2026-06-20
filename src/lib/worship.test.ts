import { describe, expect, it } from 'vitest'
import { adultWorshipSchedule, getWorshipScheduleItem, nextGenerationWorshipSchedule } from './worship'

describe('worship schedule', () => {
  it('keeps public worship schedules complete and displayable', () => {
    expect(adultWorshipSchedule).toHaveLength(6)
    expect(nextGenerationWorshipSchedule).toHaveLength(6)
    for (const item of [...adultWorshipSchedule, ...nextGenerationWorshipSchedule]) {
      expect(item).toMatchObject({
        name: expect.any(String),
        place: expect.any(String),
        day: expect.any(String),
        time: expect.any(String),
        displayTime: expect.any(String),
      })
    }
  })

  it('uses the same 새벽기도 time everywhere', () => {
    expect(getWorshipScheduleItem('새벽기도').displayTime).toBe('화-주일 오전 5:00')
  })
})
