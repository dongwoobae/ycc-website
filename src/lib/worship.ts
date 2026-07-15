import type { WorshipType } from './types'

export const autoSummaryTypes = ['주일예배', '주일찬양예배', '수요예배', '금요기도회'] as const satisfies readonly WorshipType[]

export const worshipTypes = [
  '주일예배', '주일찬양예배', '수요예배', '금요기도회', '시온찬양대', '특송', '특별행사', '기타',
] as const satisfies readonly WorshipType[]

export type PublicWorshipType = (typeof worshipTypes)[number]

export const worshipLabels: Record<WorshipType, string> = {
  주일예배: '주일예배',
  주일찬양예배: '주일찬양예배',
  수요예배: '수요예배',
  금요기도회: '금요기도회',
  // 시온찬양대가 유일한 찬양대이므로 화면에는 '찬양대'로 노출한다(데이터 키는 '시온찬양대' 유지).
  시온찬양대: '찬양대',
  특송: '특송',
  특별행사: '특별행사',
  기타: '기타',
  미분류: '미분류',
}

// '찬양'(/praise) 섹션에 속하는 유형. 나머지 공개 유형은 '예배·설교'(/sermons)에 속한다.
export const praiseWorshipTypes = ['시온찬양대', '특송'] as const satisfies readonly WorshipType[]

/** '찬양'(/praise) 섹션에 노출되는 유형인지. */
export function isPraiseWorshipType(value: string): boolean {
  return (praiseWorshipTypes as readonly string[]).includes(value)
}

// '소식' 섹션(/events)에 속하는 행사 유형. 예배·설교(/sermons) '전체'에서는 제외된다.
export const eventWorshipTypes = ['특별행사', '기타'] as const satisfies readonly WorshipType[]

/** '소식' 특별행사(/events) 섹션에 노출되는 유형인지. */
export function isEventWorshipType(value: string): boolean {
  return (eventWorshipTypes as readonly string[]).includes(value)
}

export const worshipFilterItems = [
  { label: '전체', value: '전체' },
  ...worshipTypes.map((type) => ({ label: worshipLabels[type], value: type })),
] as const

export type WorshipFilterValue = (typeof worshipFilterItems)[number]['value']

// '예배·설교'(/sermons) 페이지 필터 알약. '전체'는 찬양(시온찬양대·특송)과
// 행사(특별행사·기타)를 제외한 예배 유형만 보여준다.
export const sermonFilterPills = [
  { label: '전체', value: '전체' },
  { label: '주일예배', value: '주일예배' },
  { label: '주일찬양예배', value: '주일찬양예배' },
  { label: '수요예배', value: '수요예배' },
] as const satisfies readonly { label: string; value: WorshipFilterValue }[]

// '찬양'(/praise) 페이지 필터 알약. 데이터 키 '시온찬양대'를 '찬양대'로 노출한다.
export const praiseFilterPills = [
  { label: '전체', value: '전체' },
  { label: '찬양대', value: '시온찬양대' },
  { label: '특송', value: '특송' },
] as const satisfies readonly { label: string; value: WorshipFilterValue }[]

// '특별행사'(/events) 페이지 필터 알약. 소식 섹션에서 행사 영상을 모아 보여준다.
export const eventFilterPills = [
  { label: '전체', value: '전체' },
  { label: '특별행사', value: '특별행사' },
  { label: '기타', value: '기타' },
] as const satisfies readonly { label: string; value: WorshipFilterValue }[]

// 그리드/툴바/필터가 여러 섹션에서 공유되도록 스코프를 하나의 설정으로 묶는다.
export interface SermonScope {
  basePath: string
  pills: readonly { label: string; value: WorshipFilterValue }[]
  /** '전체'(선택 없음)일 때 노출할 유형인지 판정. */
  includes: (type: WorshipType) => boolean
}

export const sermonSectionScope: SermonScope = {
  basePath: '/sermons',
  pills: sermonFilterPills,
  includes: (type) => !isPraiseWorshipType(type) && !isEventWorshipType(type),
}

export const praiseSectionScope: SermonScope = {
  basePath: '/praise',
  pills: praiseFilterPills,
  includes: (type) => isPraiseWorshipType(type),
}

export const eventSectionScope: SermonScope = {
  basePath: '/events',
  pills: eventFilterPills,
  includes: (type) => isEventWorshipType(type),
}

export function isWorshipType(value: string): value is WorshipType {
  return value in worshipLabels
}

/** 공개 필터/배지에 노출할 worshipType인지. '미분류'는 이전 데이터 호환용으로 숨긴다. */
export function isPublicWorshipType(value: string): value is PublicWorshipType {
  return worshipTypes.includes(value as PublicWorshipType)
}

export function expectsAutoSummary(value: string): boolean {
  return (autoSummaryTypes as readonly string[]).includes(value)
}

export interface WorshipScheduleItem {
  name: string
  place: string
  day: string
  time: string
  displayTime: string
}

export const adultWorshipSchedule = [
  { name: '주일예배', place: '본당', day: '주일', time: '오전 11:00', displayTime: '주일 오전 11:00' },
  { name: '찬양예배', place: '본당', day: '주일', time: '오후 2:00', displayTime: '주일 오후 2:00' },
  { name: '수요예배', place: '본당', day: '수요일', time: '오후 7:30', displayTime: '수요일 오후 7:30' },
  { name: '새벽기도', place: '본당', day: '화-주일', time: '오전 5:00', displayTime: '화-주일 오전 5:00' },
  { name: '청춘교실', place: '유치부실', day: '금요일', time: '오전 10:00', displayTime: '금요일 오전 10:00' },
  {
    name: '금요기도회',
    place: '본당',
    day: '매월 첫째 금요일',
    time: '오후 7:30',
    displayTime: '매월 첫째 금요일 오후 7:30',
  },
] as const satisfies readonly WorshipScheduleItem[]

export const nextGenerationWorshipSchedule = [
  { name: '유치부', place: '본당 1층 유치부실', day: '주일', time: '오전 9:00', displayTime: '주일 오전 9:00' },
  { name: '아동부', place: '교육관 1층', day: '주일', time: '오전 9:00', displayTime: '주일 오전 9:00' },
  { name: '중·고등부', place: '교육관 지하', day: '주일', time: '오전 9:00', displayTime: '주일 오전 9:00' },
  { name: '청년부', place: '청년부실', day: '주일', time: '오후 2:00', displayTime: '주일 오후 2:00' },
] as const satisfies readonly WorshipScheduleItem[]

export function getWorshipScheduleItem(name: string): WorshipScheduleItem {
  const item = [...adultWorshipSchedule, ...nextGenerationWorshipSchedule].find((schedule) => schedule.name === name)
  if (!item) throw new Error(`Unknown worship schedule item: ${name}`)
  return item
}
