const KST = 'Asia/Seoul'
const kstFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: KST }) // en-CA → YYYY-MM-DD
const kstDateTimeFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: KST,
  dateStyle: 'short',
  timeStyle: 'short',
}) // sv-SE → YYYY-MM-DD HH:mm

/** timestamptz(UTC 절대시각)를 한국시간(KST) 기준 YYYY-MM-DD로 표시한다. null/무효값은 '-'. */
export function formatKstDate(value: Date | string | null | undefined): string {
  if (!value) return '-'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '-'
  return kstFormatter.format(d)
}

/** timestamptz(UTC 절대시각)를 한국시간(KST) 기준 YYYY-MM-DD HH:mm으로 표시한다. null/무효값은 '-'. */
export function formatKstDateTime(value: Date | string | null | undefined): string {
  if (!value) return '-'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '-'
  return kstDateTimeFormatter.format(d)
}

/** 폼 기본값용 — 한국시간(KST) 기준 오늘 날짜 YYYY-MM-DD. */
export function todayKst(): string {
  return kstFormatter.format(new Date())
}
