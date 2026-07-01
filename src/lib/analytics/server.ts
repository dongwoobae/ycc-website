export const MAX_DURATION_SECONDS = 2 * 60 * 60
export const DURATION_UPDATE_WINDOW_MS = 3 * 60 * 60 * 1000

export interface PageViewSummaryInput {
  visitorId: string
  sessionId: string
  durationSeconds: number
}

export interface AnalyticsSummary {
  visitors: number
  pageViews: number
  sessions: number
  averageSessionDurationSeconds: number
}

export function clampDurationSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0
  return Math.max(0, Math.min(MAX_DURATION_SECONDS, Math.floor(seconds)))
}

export function computeDurationUpdate(
  row: { visitorId: string; createdAt: Date; durationSeconds: number },
  input: { visitorId: string; seconds: number; now: Date },
): number | null {
  if (row.visitorId !== input.visitorId) return null
  if (row.createdAt.getTime() <= input.now.getTime() - DURATION_UPDATE_WINDOW_MS) return null
  return Math.max(row.durationSeconds, clampDurationSeconds(input.seconds))
}

export function summarizePageViews(rows: PageViewSummaryInput[]): AnalyticsSummary {
  const visitors = new Set<string>()
  const sessionDurations = new Map<string, number>()

  for (const row of rows) {
    visitors.add(row.visitorId)
    sessionDurations.set(row.sessionId, (sessionDurations.get(row.sessionId) ?? 0) + row.durationSeconds)
  }

  const totalSessionDuration = Array.from(sessionDurations.values()).reduce((sum, seconds) => sum + seconds, 0)
  const sessions = sessionDurations.size

  return {
    visitors: visitors.size,
    pageViews: rows.length,
    sessions,
    averageSessionDurationSeconds: sessions ? Math.round(totalSessionDuration / sessions) : 0,
  }
}
