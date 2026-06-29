import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import type { WorshipType } from '@/lib/types'
import { listPlaylistVideos, type YouTubeVideo } from '@/lib/youtube/client'
import { insertSermon } from './ingest'
import { resolvePlaylists } from './playlists'
import { claimSermonById, summarizeClaimed, fetchAndStoreTranscript } from './summarize'

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

export async function resyncAllSermons(): Promise<{ inserted: number; summarized: number }> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) throw new Error('YOUTUBE_API_KEY is not set')

  const playlists = resolvePlaylists(process.env as Record<string, string | undefined>)
  let inserted = 0
  let summarized = 0
  const existing = await db.select({ id: sermons.youtubeVideoId }).from(sermons)
  const existingIds = new Set(existing.map((r) => r.id).filter((x): x is string => !!x))

  for (const p of playlists) {
    try {
      const videos = await listPlaylistVideos(p.playlistId, apiKey)
      for (const video of videos) {
        if (existingIds.has(video.videoId)) continue
        existingIds.add(video.videoId)
        const sermonId = await insertSermon(video, p.worshipType)
        if (!sermonId) continue
        inserted++
        if (!p.autoSummary) continue
        let transcriptText: string
        try {
          transcriptText = await fetchAndStoreTranscript(sermonId, video.videoId)
        } catch {
          continue // 자막 미준비 — 등록·공개만, 요약은 추후 보충
        }
        const claimed = await claimSermonById(sermonId)
        if (!claimed) continue
        const status = await summarizeClaimed(claimed.id, claimed.durationSeconds, transcriptText)
        if (status === 'ready') summarized++
      }
    } catch (e) {
      console.error(`[sync] playlist ${p.playlistId} failed`, e)
    }
  }
  return { inserted, summarized }
}
