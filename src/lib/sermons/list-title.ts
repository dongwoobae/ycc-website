/** 제목에서 "/" 뒤(실제 설교 주제)만 남긴다. "/"가 없으면 원본 그대로. */
export function cleanSermonTitle(title: string): string {
  const i = title.indexOf('/')
  if (i === -1) return title.trim()
  return title.slice(i + 1).trim() || title.trim()
}

/** 목록에 표시할 제목. 관리자가 지정한 displayTitle이 우선, 없으면 자동 정리. */
export function sermonListTitle(sermon: { title: string; displayTitle?: string | null }): string {
  const override = sermon.displayTitle?.trim()
  return override || cleanSermonTitle(sermon.title)
}
