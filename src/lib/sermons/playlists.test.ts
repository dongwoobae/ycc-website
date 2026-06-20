import { describe, expect, it } from 'vitest'
import { resolvePlaylists } from './playlists'

describe('resolvePlaylists', () => {
  it('keeps only configured ids, sorted by priority (worship first)', () => {
    const out = resolvePlaylists({
      YT_PLAYLIST_SPECIAL_EVENT: 'PLevent',
      YT_PLAYLIST_SUNDAY: 'PLsun',
      YT_PLAYLIST_CHOIR: '',
    })
    expect(out.map((p) => p.playlistId)).toEqual(['PLsun', 'PLevent'])
    expect(out[0]).toMatchObject({ worshipType: '주일예배', autoSummary: true })
    expect(out[1]).toMatchObject({ worshipType: '특별행사', autoSummary: false })
  })
})
