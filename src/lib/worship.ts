import type { WorshipType } from './types'

export const worshipTypes = ['주일예배', '주일찬양예배', '수요예배', '금요기도회'] as const satisfies readonly WorshipType[]

export const worshipLabels: Record<WorshipType, string> = {
  주일예배: '주일예배',
  주일찬양예배: '주일찬양예배',
  수요예배: '수요예배',
  금요기도회: '금요기도회',
}

export const worshipFilterItems = [
  { label: '전체', value: '전체' },
  ...worshipTypes.map((type) => ({ label: worshipLabels[type], value: type })),
] as const

export type WorshipFilterValue = (typeof worshipFilterItems)[number]['value']

export function isWorshipType(value: string): value is WorshipType {
  return worshipTypes.includes(value as WorshipType)
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
  { name: '영아부', place: '유치부실', day: '주일', time: '오전 9:00', displayTime: '주일 오전 9:00' },
  { name: '유치부', place: '유치부실', day: '주일', time: '오전 9:00', displayTime: '주일 오전 9:00' },
  { name: '아동부', place: '선교관 1층', day: '주일', time: '오전 9:00', displayTime: '주일 오전 9:00' },
  { name: '중등부', place: '선교관 지하', day: '주일', time: '오전 9:00', displayTime: '주일 오전 9:00' },
  { name: '고등부', place: '선교관 지하', day: '주일', time: '오전 9:00', displayTime: '주일 오전 9:00' },
  { name: '청년부', place: '청년부실', day: '주일', time: '오후 2:00', displayTime: '주일 오후 2:00' },
] as const satisfies readonly WorshipScheduleItem[]

export function getWorshipScheduleItem(name: string): WorshipScheduleItem {
  const item = [...adultWorshipSchedule, ...nextGenerationWorshipSchedule].find((schedule) => schedule.name === name)
  if (!item) throw new Error(`Unknown worship schedule item: ${name}`)
  return item
}
