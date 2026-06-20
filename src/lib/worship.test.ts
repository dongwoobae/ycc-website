import { describe, expect, it } from 'vitest'
import { adultWorshipSchedule, getWorshipScheduleItem, nextGenerationWorshipSchedule, worshipLabels, worshipTypes } from './worship'

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

describe('worship types (7종)', () => {
  it('includes all seven categories', () => {
    expect(worshipTypes).toHaveLength(7)
    for (const t of ['주일예배', '주일찬양예배', '수요예배', '금요기도회', '시온찬양대', '특송', '특별행사']) {
      expect(worshipTypes).toContain(t)
      expect(worshipLabels[t as (typeof worshipTypes)[number]]).toBe(t)
    }
  })
})
