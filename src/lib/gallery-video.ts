// 영상 업로드 정책 — 관리자 폼(클라이언트)과 presign 서버 액션이 공유한다.
// 'server-only' 금지: 클라이언트 번들에 포함된다.
export const maxVideoSize = 200 * 1024 * 1024

export const videoExtByMime = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
} as const

export type AllowedVideoMime = keyof typeof videoExtByMime

export function isAllowedVideoMime(contentType: string): contentType is AllowedVideoMime {
  return contentType in videoExtByMime
}

export function videoUploadProblem(contentType: string, size: number): string | null {
  if (!isAllowedVideoMime(contentType)) {
    return '지원하지 않는 영상 형식입니다. mp4(H.264)를 권장합니다.'
  }
  if (!Number.isFinite(size) || size <= 0) return '잘못된 영상 파일입니다.'
  if (size > maxVideoSize) return '영상은 200MB 이하만 업로드할 수 있습니다.'
  return null
}
