/**
 * 설교 제목의 6자리 날짜(YYMMDD)를 'YYYY-MM-DD'로 변환한다.
 * (예: '영천중앙교회 260621 주일예배' → '2026-06-21')
 * 날짜 토큰이 없거나 유효하지 않으면 null.
 */
export function sermonDateFromTitle(title: string): string | null {
  const m = /(?<!\d)(\d{2})(\d{2})(\d{2})(?!\d)/.exec(title ?? '')
  if (!m) return null
  const [, yy, mm, dd] = m
  const month = Number(mm)
  const day = Number(dd)
  if (month < 1 || month > 12) return null
  // 해당 월의 실제 일수(윤년 포함)로 검증해 02-31 같은 잘못된 날짜를 거른다.
  const daysInMonth = new Date(2000 + Number(yy), month, 0).getDate()
  if (day < 1 || day > daysInMonth) return null
  return `20${yy}-${mm}-${dd}`
}
