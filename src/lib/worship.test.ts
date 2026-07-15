import { describe, expect, it } from 'vitest'
import {
  adultWorshipSchedule,
  eventFilterPills,
  eventSectionScope,
  expectsAutoSummary,
  getWorshipScheduleItem,
  isEventWorshipType,
  isPraiseWorshipType,
  isPublicWorshipType,
  nextGenerationWorshipSchedule,
  praiseFilterPills,
  praiseSectionScope,
  sermonFilterPills,
  sermonSectionScope,
  worshipLabels,
  worshipTypes,
} from './worship'

describe('worship schedule', () => {
  it('keeps public worship schedules complete and displayable', () => {
    expect(adultWorshipSchedule).toHaveLength(6)
    expect(nextGenerationWorshipSchedule).toHaveLength(4)
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

describe('worship types (8종)', () => {
  it('includes all eight public categories', () => {
    expect(worshipTypes).toHaveLength(8)
    for (const t of ['주일예배', '주일찬양예배', '수요예배', '금요기도회', '시온찬양대', '특송', '특별행사', '기타']) {
      expect(worshipTypes).toContain(t)
    }
  })

  it('labels every type as itself except 시온찬양대(→찬양대)', () => {
    for (const t of ['주일예배', '주일찬양예배', '수요예배', '금요기도회', '특송', '특별행사', '기타']) {
      expect(worshipLabels[t as (typeof worshipTypes)[number]]).toBe(t)
    }
    // 시온찬양대가 유일한 찬양대이므로 화면 라벨은 '찬양대'.
    expect(worshipLabels.시온찬양대).toBe('찬양대')
  })
})

describe('예배·설교 / 찬양 섹션 분리', () => {
  it('classifies 찬양 유형만 praise 로', () => {
    expect(isPraiseWorshipType('시온찬양대')).toBe(true)
    expect(isPraiseWorshipType('특송')).toBe(true)
    for (const t of ['주일예배', '주일찬양예배', '수요예배', '금요기도회', '특별행사', '기타']) {
      expect(isPraiseWorshipType(t)).toBe(false)
    }
  })

  it('scopes each section to its own base path and pill values', () => {
    expect(sermonSectionScope.basePath).toBe('/sermons')
    expect(praiseSectionScope.basePath).toBe('/praise')
    expect(sermonFilterPills.map((p) => p.value)).toEqual(['전체', '주일예배', '주일찬양예배', '수요예배'])
    expect(praiseFilterPills.map((p) => p.value)).toEqual(['전체', '시온찬양대', '특송'])
  })

  it("'전체' scope keeps 찬양 out of 예배·설교 and vice versa", () => {
    // 예배·설교 '전체'는 찬양 유형을 제외
    expect(sermonSectionScope.includes('주일예배')).toBe(true)
    expect(sermonSectionScope.includes('시온찬양대')).toBe(false)
    expect(sermonSectionScope.includes('특송')).toBe(false)
    // 찬양 '전체'는 찬양 유형만
    expect(praiseSectionScope.includes('시온찬양대')).toBe(true)
    expect(praiseSectionScope.includes('특송')).toBe(true)
    expect(praiseSectionScope.includes('주일예배')).toBe(false)
    // 예배·설교 '전체'는 행사 유형도 제외 (소식 /events 로 이동)
    expect(sermonSectionScope.includes('특별행사')).toBe(false)
    expect(sermonSectionScope.includes('기타')).toBe(false)
  })
})

describe('미분류 worship type', () => {
  it('has a label but is excluded from public filter items', () => {
    expect(worshipLabels.미분류).toBe('미분류')
    expect(worshipTypes).not.toContain('미분류')
    expect(isPublicWorshipType('미분류')).toBe(false)
    expect(isPublicWorshipType('주일예배')).toBe(true)
  })

  it('uses worshipType as the auto-summary source of truth', () => {
    for (const t of ['주일예배', '주일찬양예배', '수요예배', '금요기도회']) {
      expect(expectsAutoSummary(t)).toBe(true)
    }
    for (const t of ['시온찬양대', '특송', '특별행사', '기타', '미분류']) {
      expect(expectsAutoSummary(t)).toBe(false)
    }
  })
})

describe('특별행사/기타 → 소식(/events) 섹션 분리', () => {
  it('classifies 특별행사·기타만 event 로', () => {
    expect(isEventWorshipType('특별행사')).toBe(true)
    expect(isEventWorshipType('기타')).toBe(true)
    for (const t of ['주일예배', '주일찬양예배', '수요예배', '금요기도회', '시온찬양대', '특송']) {
      expect(isEventWorshipType(t)).toBe(false)
    }
  })

  it('event 스코프는 /events 기반, 알약은 전체·특별행사·기타', () => {
    expect(eventSectionScope.basePath).toBe('/events')
    expect(eventFilterPills.map((p) => p.value)).toEqual(['전체', '특별행사', '기타'])
  })

  it("'전체' 스코프: 예배·설교는 행사 제외, event 는 행사만", () => {
    expect(sermonSectionScope.includes('특별행사')).toBe(false)
    expect(sermonSectionScope.includes('기타')).toBe(false)
    expect(sermonSectionScope.includes('주일예배')).toBe(true)
    expect(sermonSectionScope.includes('금요기도회')).toBe(true)
    expect(eventSectionScope.includes('특별행사')).toBe(true)
    expect(eventSectionScope.includes('기타')).toBe(true)
    expect(eventSectionScope.includes('주일예배')).toBe(false)
    expect(eventSectionScope.includes('시온찬양대')).toBe(false)
  })
})
