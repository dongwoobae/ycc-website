import { describe, expect, it } from 'vitest'
import { isAllowedVideoMime, maxVideoSize, videoUploadProblem } from './gallery-video'

describe('isAllowedVideoMime', () => {
  it('mp4·quicktime·webm만 허용한다', () => {
    expect(isAllowedVideoMime('video/mp4')).toBe(true)
    expect(isAllowedVideoMime('video/quicktime')).toBe(true)
    expect(isAllowedVideoMime('video/webm')).toBe(true)
    expect(isAllowedVideoMime('video/x-msvideo')).toBe(false)
    expect(isAllowedVideoMime('image/png')).toBe(false)
    expect(isAllowedVideoMime('')).toBe(false)
    expect(isAllowedVideoMime('constructor')).toBe(false)
    expect(isAllowedVideoMime('toString')).toBe(false)
  })
})

describe('videoUploadProblem', () => {
  it('정상 입력이면 null', () => {
    expect(videoUploadProblem('video/mp4', 10 * 1024 * 1024)).toBeNull()
  })
  it('허용 외 형식이면 메시지', () => {
    expect(videoUploadProblem('video/avi', 1024)).toBe('지원하지 않는 영상 형식입니다. mp4(H.264)를 권장합니다.')
  })
  it('200MB 초과면 메시지', () => {
    expect(videoUploadProblem('video/mp4', maxVideoSize + 1)).toBe('영상은 200MB 이하만 업로드할 수 있습니다.')
  })
  it('0 이하·비정상 크기면 메시지', () => {
    expect(videoUploadProblem('video/mp4', 0)).not.toBeNull()
    expect(videoUploadProblem('video/mp4', Number.NaN)).not.toBeNull()
  })
  it('정확히 200MB는 허용한다', () => {
    expect(videoUploadProblem('video/mp4', maxVideoSize)).toBeNull()
  })
})
