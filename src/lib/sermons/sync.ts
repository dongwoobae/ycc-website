import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import { publishJob } from '@/lib/qstash'
import type { WorshipType } from '@/lib/types'
import type { YouTubeVideo } from '@/lib/youtube/client'
import { fetchChannelVideos } from '@/lib/youtube/rapidapi-channel'
import { classifyByTitle } from './classify-title'
import { insertSermon } from './ingest'
import { claimSermonById, summarizeClaimed, fetchAndStoreTranscript } from './summarize'

/** 자동 요약 대상 예배 유형 (정기 예배만). 그 외(시온찬양대·특송·특별행사·미분류)는 등록만 한다. */
const AUTO_SUMMARY_TYPES: ReadonlySet<WorshipType> = new Set<WorshipType>([
  '주일예배',
  '주일찬양예배',
  '수요예배',
  '금요기도회',
])

export interface SyncProgress {
  current: number
  total: number
  title: string
  phase: string
}

export interface PlaylistVideo extends YouTubeVideo {
  worshipType: WorshipType
}

export interface NewSermonInsert {
  youtubeVideoId: string
  title: string
  preacher: null
  worshipType: WorshipType
  sermonDate: string
  videoUrl: string
  thumbnailUrl: string | null
  durationSeconds: number
}

export function planSermonInserts(existingIds: Set<string>, videos: PlaylistVideo[]): NewSermonInsert[] {
  const seen = new Set(existingIds)
  const out: NewSermonInsert[] = []
  for (const v of videos) {
    if (seen.has(v.videoId)) continue
    seen.add(v.videoId)
    out.push({
      youtubeVideoId: v.videoId,
      title: v.title,
      preacher: null,
      worshipType: v.worshipType,
      sermonDate: (v.publishedAt || '').slice(0, 10),
      videoUrl: `https://youtu.be/${v.videoId}`,
      thumbnailUrl: v.thumbnailUrl,
      durationSeconds: v.durationSeconds,
    })
  }
  return out
}

export async function resyncAllSermons(
  onProgress?: (p: SyncProgress) => void,
): Promise<{ inserted: number; summarized: number }> {
  const channelId = process.env.YOUTUBE_CHANNEL_ID
  if (!channelId) throw new Error('YOUTUBE_CHANNEL_ID is not set')
  const maxPages = Number(process.env.SYNC_MAX_PAGES ?? 4)

  let inserted = 0
  let summarized = 0
  const existing = await db.select({ id: sermons.youtubeVideoId }).from(sermons)
  const existingIds = new Set(existing.map((r) => r.id).filter((x): x is string => !!x))

  const videos = await fetchChannelVideos(channelId, maxPages)
  const newVideos = videos.filter((v) => !existingIds.has(v.videoId))
  const total = newVideos.length

  let current = 0
  for (const video of newVideos) {
    current++
    const worshipType = classifyByTitle(video.title)
    const autoSummary = AUTO_SUMMARY_TYPES.has(worshipType)
    onProgress?.({ current, total, title: video.title, phase: autoSummary ? '자막·요약 중' : '등록' })

    const sermonId = await insertSermon(video, worshipType)
    if (!sermonId) continue
    inserted++
    if (!autoSummary) continue

    let transcriptText: string
    try {
      transcriptText = await fetchAndStoreTranscript(sermonId, video.videoId)
    } catch {
      // 자막 미준비 — 등록만 하고, 백그라운드(QStash)로 재시도를 넘긴다(best-effort).
      try {
        await publishJob('fetch-transcript', { sermonId, videoId: video.videoId })
      } catch {
        // QStash 미설정(로컬 등)에서도 동기화 자체는 계속 진행.
      }
      continue
    }
    const claimed = await claimSermonById(sermonId)
    if (!claimed) continue
    const status = await summarizeClaimed(claimed.id, claimed.durationSeconds, transcriptText, claimed.attempts)
    if (status === 'ready') summarized++
  }
  return { inserted, summarized }
}
