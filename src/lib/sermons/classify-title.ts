import type { WorshipType } from '@/lib/types'

/**
 * 제목 키워드로 예배 유형을 추정한다. 우선순위 순서가 중요하다.
 * (예: '주일찬양예배'는 '주일예배'보다 먼저 검사해야 한다.)
 */
const RULES: ReadonlyArray<readonly [RegExp, WorshipType]> = [
  [/주일\s*찬양\s*예배/, '주일찬양예배'],
  [/주일\s*예배/, '주일예배'],
  [/수요\s*예배/, '수요예배'],
  [/금요(\s*기도회|\s*예배|\s*철야)?/, '금요기도회'],
  [/(시온\s*)?찬양대/, '시온찬양대'],
  [/특송/, '특송'],
  [/(특별\s*행사|특별\s*예배|행사)/, '특별행사'],
]

/** 제목으로 WorshipType을 결정한다. 매칭 실패 시 '미분류'. */
export function classifyByTitle(title: string): WorshipType {
  const t = title ?? ''
  for (const [pattern, type] of RULES) {
    if (pattern.test(t)) return type
  }
  return '미분류'
}
