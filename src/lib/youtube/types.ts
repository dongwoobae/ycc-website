/** 목록 조회로 얻는 최소 정보. 길이·썸네일이 아직 없다. */
export interface YouTubeVideoCandidate {
  videoId: string
  title: string
  publishedAt: string
}

/** 등록에 필요한 값이 모두 채워진 영상. insertSermon은 이것만 받는다. */
export interface YouTubeVideo extends YouTubeVideoCandidate {
  thumbnailUrl: string | null
  durationSeconds: number
}
