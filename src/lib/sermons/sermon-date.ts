const DAY_MS = 24 * 60 * 60 * 1000
const MAX_UPLOAD_GAP_MS = 183 * DAY_MS

function isoDate(year: number, month: number, day: number): string | null {
  // 해당 월의 실제 일수(윤년 포함)로 검증해 02-31 같은 잘못된 날짜를 거른다.
  if (day > new Date(year, month, 0).getDate()) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * 설교 제목의 날짜(YYMMDD 또는 YYYYMMDD)를 'YYYY-MM-DD'로 변환한다.
 * (예: '영천중앙교회 260621 주일예배' → '2026-06-21')
 * 날짜 토큰이 없거나 유효하지 않으면 null.
 *
 * 연도는 제목이 아니라 업로드 시각에 가장 가까운 해로 정한다. 제목 연도 오타(260920을 060920으로)가
 * 실제로 올라왔고, 새해 첫 주에 지난해 연도를 쓰는 오타도 같은 방식으로 잡힌다. 현재 연도가 아니라
 * 업로드 시각을 기준으로 삼는 이유는 지난해 영상을 나중에 일괄 등록하는 경우(시드) 때문이다.
 * 대가로, 촬영 후 반년 넘게 지나 올린 영상은 연도가 업로드 쪽으로 끌려간다.
 * 업로드 시각을 해석할 수 없으면 제목 연도를 그대로 쓴다.
 */
export function sermonDateFromTitle(title: string, publishedAt: string): string | null {
  const m = /(?<!\d)(?:20)?(\d{2})(\d{2})(\d{2})(?!\d)/.exec(title ?? '')
  if (!m) return null
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12 || day < 1) return null

  const uploadedAt = Date.parse(publishedAt)
  if (Number.isNaN(uploadedAt)) return isoDate(2000 + Number(m[1]), month, day)

  const uploadYear = new Date(uploadedAt).getUTCFullYear()
  let best: string | null = null
  let bestGap = Infinity
  for (const year of [uploadYear - 1, uploadYear, uploadYear + 1]) {
    const date = isoDate(year, month, day)
    if (!date) continue
    const gap = Math.abs(Date.parse(date) - uploadedAt)
    if (gap < bestGap) {
      best = date
      bestGap = gap
    }
  }
  return bestGap <= MAX_UPLOAD_GAP_MS ? best : null
}
