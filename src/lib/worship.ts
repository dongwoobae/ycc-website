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
