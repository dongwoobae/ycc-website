// bulletin_date 는 date 컬럼이라 'YYYY-MM-DD' 문자열로 온다.
// new Date() 로 파싱하면 UTC 로 해석돼 하루가 밀릴 수 있으므로 문자열을 그대로 쪼갠다.
const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/

function parts(value: string) {
  const match = value.match(isoDatePattern)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

/** 화면 표기용. 예: `2026. 7. 26` */
export function formatBulletinDate(value: string): string {
  const p = parts(value)
  if (!p) return value
  return `${p.year}. ${p.month}. ${p.day}`
}

/** 권·호 아이브로우. 둘 다 비면 빈 문자열이며 호출부가 렌더를 생략한다. */
export function formatIssueLabel(volume: string, issue: string): string {
  return [volume.trim(), issue.trim()].filter(Boolean).join(' ')
}

/**
 * 면 이미지 alt. 이미지 방식은 본문을 스크린리더에 전달하지 못하므로
 * 최소한 어느 주보의 몇 번째 면인지는 알린다.
 */
export function formatPageAlt(bulletinDate: string, pageNumber: number): string {
  const p = parts(bulletinDate)
  const label = p ? `${p.year}년 ${p.month}월 ${p.day}일` : bulletinDate
  return `${label} 주보 ${pageNumber}면`
}
