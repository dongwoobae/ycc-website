// 한국어 성경 책이름(접두 숫자 포함) + 장·절 위치를 추출한다.
// 콜론 표기와 한글 표기를 모두 지원하며, 결과는 항상 "책 장:절" 형태로 정규화한다.
//   콜론: 마태복음 5:3, 고린도전서 13:4, 요한복음 3:16-17
//   한글: 빌립보서 4장 19절, 사도행전 13장 1-3절, 야고보서 1장 19~25절
const COLON_RE = /([1-3]?[가-힣]{1,6})\s*(\d{1,3}):(\d{1,3}(?:-\d{1,3})?)/
const KOREAN_RE = /([1-3]?[가-힣]{1,6})\s*(\d{1,3})\s*장\s*(\d{1,3}(?:[-~]\d{1,3})?)\s*절/

export function extractScripture(summary: string | null | undefined): string {
  if (!summary) return ''

  const colon = summary.match(COLON_RE)
  if (colon) return `${colon[1]} ${colon[2]}:${colon[3]}`

  const korean = summary.match(KOREAN_RE)
  if (korean) return `${korean[1]} ${korean[2]}:${korean[3].replace('~', '-')}`

  return ''
}
