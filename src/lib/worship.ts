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
  시온찬양대: '시온찬양대',
  특송: '특송',
  특별행사: '특별행사',
  기타: '기타',
  미분류: '미분류',
}

export const worshipFilterItems = [
  { label: '전체', value: '전체' },
  ...worshipTypes.map((type) => ({ label: worshipLabels[type], value: type })),
] as const

export type WorshipFilterValue = (typeof worshipFilterItems)[number]['value']

// 설교 페이지에 실제로 노출하는 필터 알약(4개).
// 시온찬양대·특송은 '말씀과 찬양' 메뉴, 특별행사·기타는 '소식' 메뉴의 링크(?worship=)로 진입한다.
// (필터 로직 자체는 worshipTypes 전체를 계속 지원하므로 링크 진입 시 정상 필터링됨)
export const sermonFilterPills = [
  { label: '전체', value: '전체' },
  { label: '주일예배', value: '주일예배' },
  { label: '주일찬양예배', value: '주일찬양예배' },
  { label: '수요예배', value: '수요예배' },
] as const satisfies readonly { label: string; value: WorshipFilterValue }[]

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
