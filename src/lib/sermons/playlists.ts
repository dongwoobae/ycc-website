import type { WorshipType } from '@/lib/types'

export interface ResolvedPlaylist {
  playlistId: string
  worshipType: WorshipType
  autoSummary: boolean
  priority: number
}

interface PlaylistDef {
  envKey: string
  worshipType: WorshipType
  autoSummary: boolean
  priority: number
}

const DEFS: PlaylistDef[] = [
  { envKey: 'YT_PLAYLIST_SUNDAY', worshipType: '주일예배', autoSummary: true, priority: 1 },
  { envKey: 'YT_PLAYLIST_WEDNESDAY', worshipType: '수요예배', autoSummary: true, priority: 2 },
  { envKey: 'YT_PLAYLIST_FRIDAY', worshipType: '금요기도회', autoSummary: true, priority: 3 },
  { envKey: 'YT_PLAYLIST_SUNDAY_PRAISE', worshipType: '주일찬양예배', autoSummary: true, priority: 4 },
  { envKey: 'YT_PLAYLIST_SPECIAL_EVENT', worshipType: '특별행사', autoSummary: false, priority: 5 },
  { envKey: 'YT_PLAYLIST_CHOIR', worshipType: '시온찬양대', autoSummary: false, priority: 6 },
  { envKey: 'YT_PLAYLIST_SPECIAL_SONG', worshipType: '특송', autoSummary: false, priority: 7 },
]

export function resolvePlaylists(env: Record<string, string | undefined>): ResolvedPlaylist[] {
  return DEFS.map((d) => ({ ...d, playlistId: (env[d.envKey] ?? '').trim() }))
    .filter((d) => d.playlistId.length > 0)
    .sort((a, b) => a.priority - b.priority)
    .map(({ playlistId, worshipType, autoSummary, priority }) => ({ playlistId, worshipType, autoSummary, priority }))
}
