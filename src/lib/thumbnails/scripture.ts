// 한국어 성경 책이름(접두 숫자 포함) + "장:절" 또는 "장:절-절" 패턴.
// 예: 마태복음 5:3, 고린도전서 13:4, 요한복음 3:16-17
const SCRIPTURE_RE = /([1-3]?[가-힣]{1,6})\s*(\d{1,3}:\d{1,3}(?:-\d{1,3})?)/

export function extractScripture(summary: string | null | undefined): string {
  if (!summary) return ''
  const match = summary.match(SCRIPTURE_RE)
  return match ? `${match[1]} ${match[2]}` : ''
}
