import type { WorshipType } from '@/lib/types'
import { listPlaylistVideos } from '@/lib/youtube/client'
import { resolvePlaylists, type ResolvedPlaylist } from './playlists'

export interface WorshipResolution {
  worshipType: WorshipType
  autoSummary: boolean
}

export interface PlaylistContainment extends ResolvedPlaylist {
  contains: boolean
}

export function chooseWorshipResolution(items: PlaylistContainment[]): WorshipResolution | null {
  const match = items.filter((item) => item.contains).sort((a, b) => a.priority - b.priority)[0]
  return match ? { worshipType: match.worshipType, autoSummary: match.autoSummary } : null
}

export async function classifyVideo(
  videoId: string,
  env: Record<string, string | undefined>
): Promise<WorshipResolution | null> {
  const apiKey = env.YOUTUBE_API_KEY
  if (!apiKey) throw new Error('YOUTUBE_API_KEY is not set')
  const playlists = resolvePlaylists(env)
  const checks: PlaylistContainment[] = []
  for (const playlist of playlists) {
    const videos = await listPlaylistVideos(playlist.playlistId, apiKey)
    checks.push({ ...playlist, contains: videos.some((video) => video.videoId === videoId) })
  }
  return chooseWorshipResolution(checks)
}
