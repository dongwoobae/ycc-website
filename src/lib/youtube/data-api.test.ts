import { describe, expect, it } from 'vitest'
import {
  apiErrorReason,
  normalizePlaylistItems,
  normalizeVideoDetails,
  parseIsoDuration,
  uploadsPlaylistId,
} from './data-api'

describe('uploadsPlaylistId', () => {
  it('UC 접두를 UU로 바꾼다', () => {
    expect(uploadsPlaylistId('UCzB3UsqsJhtFUvPEeOtTL6g')).toBe('UUzB3UsqsJhtFUvPEeOtTL6g')
  })
})

describe('parseIsoDuration', () => {
  it('시·분·초를 초로 바꾼다', () => {
    expect(parseIsoDuration('PT1H3M23S')).toBe(3803)
    expect(parseIsoDuration('PT34M37S')).toBe(2077)
    expect(parseIsoDuration('PT3M37S')).toBe(217)
    expect(parseIsoDuration('PT0S')).toBe(0)
  })

  it('형식이 아니면 null', () => {
    expect(parseIsoDuration('34:37')).toBeNull()
    expect(parseIsoDuration('P')).toBeNull()
    expect(parseIsoDuration(undefined)).toBeNull()
  })
})

describe('normalizePlaylistItems', () => {
  it('업로드 시각은 contentDetails.videoPublishedAt에서 온다', () => {
    expect(
      normalizePlaylistItems({
        items: [
          {
            snippet: { title: '영천중앙교회 260916 수요예배 /', publishedAt: '2020-01-01T00:00:00Z' },
            contentDetails: { videoId: 'c-oLFHUSx8A', videoPublishedAt: '2026-09-16T11:43:13Z' },
          },
        ],
      }),
    ).toEqual([
      {
        videoId: 'c-oLFHUSx8A',
        title: '영천중앙교회 260916 수요예배 /',
        publishedAt: '2026-09-16T11:43:13Z',
      },
    ])
  })

  it('videoId가 없는 항목과 비배열 응답은 버린다', () => {
    expect(normalizePlaylistItems({ items: [{ snippet: { title: 't' } }] })).toEqual([])
    expect(normalizePlaylistItems({})).toEqual([])
    expect(normalizePlaylistItems(null)).toEqual([])
  })
})

describe('normalizeVideoDetails', () => {
  it('길이와 라이브 여부를 videoId로 색인한다', () => {
    const map = normalizeVideoDetails({
      items: [
        {
          id: 'c-oLFHUSx8A',
          snippet: { liveBroadcastContent: 'none' },
          contentDetails: { duration: 'PT34M37S' },
        },
        {
          id: 'live-1',
          snippet: { liveBroadcastContent: 'live' },
          contentDetails: { duration: 'PT1H' },
        },
      ],
    })

    expect(map.get('c-oLFHUSx8A')).toEqual({ durationSeconds: 2077, isLiveOrUpcoming: false })
    expect(map.get('live-1')).toEqual({ durationSeconds: 3600, isLiveOrUpcoming: true })
  })

  it('길이를 못 읽은 항목은 넣지 않는다', () => {
    const map = normalizeVideoDetails({
      items: [{ id: 'bad', snippet: { liveBroadcastContent: 'none' }, contentDetails: {} }],
    })
    expect(map.size).toBe(0)
  })

  it('길이가 0 이하(P0D·PT0S)인 항목은 넣지 않는다 — 방송 중이거나 VOD 처리가 끝나지 않은 신호다', () => {
    const map = normalizeVideoDetails({
      items: [
        { id: 'processing', snippet: { liveBroadcastContent: 'none' }, contentDetails: { duration: 'P0D' } },
        { id: 'live-zero', snippet: { liveBroadcastContent: 'live' }, contentDetails: { duration: 'PT0S' } },
      ],
    })
    expect(map.size).toBe(0)
  })
})

describe('apiErrorReason', () => {
  it('키가 무효한 400은 details의 API_KEY_INVALID로 갈린다 — errors[0]은 badRequest라 값 오류와 구분되지 않는다', () => {
    expect(
      apiErrorReason({
        error: {
          code: 400,
          message: 'API key not valid. Please pass a valid API key.',
          errors: [
            { message: 'API key not valid. Please pass a valid API key.', domain: 'global', reason: 'badRequest' },
          ],
          status: 'INVALID_ARGUMENT',
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
              reason: 'API_KEY_INVALID',
              domain: 'googleapis.com',
            },
            {
              '@type': 'type.googleapis.com/google.rpc.LocalizedMessage',
              locale: 'en-US',
              message: 'API key not valid.',
            },
          ],
        },
      }),
    ).toBe('API_KEY_INVALID')
  })

  it('playlistId 값이 잘못된 400은 errors[0].reason에서 온다', () => {
    expect(
      apiErrorReason({
        error: {
          code: 400,
          message: 'Invalid Value',
          errors: [{ message: 'Invalid Value', domain: 'global', reason: 'invalid' }],
        },
      }),
    ).toBe('invalid')
  })

  it('재생목록 없음 404', () => {
    expect(
      apiErrorReason({
        error: {
          code: 404,
          errors: [{ domain: 'youtube.playlistItem', reason: 'playlistNotFound', location: 'playlistId' }],
        },
      }),
    ).toBe('playlistNotFound')
  })

  it('403은 errors 배열 자체가 없고 details만 있다', () => {
    expect(
      apiErrorReason({
        error: {
          code: 403,
          status: 'PERMISSION_DENIED',
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
              reason: 'API_KEY_SERVICE_BLOCKED',
              domain: 'googleapis.com',
            },
          ],
        },
      }),
    ).toBe('API_KEY_SERVICE_BLOCKED')
  })

  it('사유를 못 찾거나 코드 형태가 아니면 null — 자유 문자열을 로그로 흘리지 않는다', () => {
    expect(apiErrorReason({ error: { code: 400, message: 'Invalid Value' } })).toBeNull()
    expect(apiErrorReason({ error: { errors: [{ reason: 'key AIzaSyXXXX is bad' }] } })).toBeNull()
    expect(apiErrorReason(null)).toBeNull()
    expect(apiErrorReason('<html>502</html>')).toBeNull()
  })
})
