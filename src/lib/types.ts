export type WorshipType =
  '주일예배' | '주일찬양예배' | '수요예배' | '금요기도회' | '시온찬양대' | '특송' | '특별행사' | '기타' | '미분류'

export interface SermonChapter {
  startSeconds: number
  title: string
  summary: string
}

export interface Sermon {
  id: string
  title: string
  displayTitle?: string
  preacher?: string
  worshipType: WorshipType
  sermonDate: string
  videoUrl: string
  youtubeId: string
  youtubeVideoId?: string
  durationSeconds?: number
  thumbnailUrl?: string
  summary?: string
  quickSummary?: string[]
  chapters?: SermonChapter[]
  // no_transcript = 유튜브가 자막을 끝내 생성하지 않은 종결 상태(재시도 대상 아님). failed와 구분한다.
  summaryStatus: 'none' | 'pending' | 'ready' | 'failed' | 'no_transcript'
  isPublished: boolean
}

/** 「이번 주 일정 · 공지」 통합 리스트 항목. when이 있으면 시간 배지를 앞에 붙인다. */
export interface BulletinNotice {
  title: string
  detail: string
  when?: string
}

/**
 * 원본 주보 면 이미지. 배열 순서가 면 순서다.
 * width·height는 full 기준이며 세 크기의 종횡비가 같으므로 한 번만 저장한다.
 */
export interface BulletinPage {
  width: number
  height: number
  /** 긴 변 2000px — 라이트박스 */
  fullUrl: string
  /** 긴 변 1000px — 인라인 큰 이미지, 목록 표지, 홈 카드 */
  previewUrl: string
  /** 긴 변 320px — 인라인 썸네일 스트립 */
  thumbUrl: string
}

export interface Bulletin {
  id: string
  bulletinDate: string
  volume: string
  issue: string
  sermonTitle: string
  /** 설교 본문 (예: 마태복음 7:24-27) */
  scripture: string
  preacher: string
  /** 찬송가 번호. 자유 텍스트 (예: 새 210장 · 통 40장) */
  hymns: string
  /** 교독문 번호 */
  responsiveReading: string
  /** 다음 주 예고 한 줄 */
  nextWeek: string
  /** R2 원본 PDF. 이미지를 직접 올린 경우 없다 */
  pdfUrl?: string
  notices: BulletinNotice[]
  pages: BulletinPage[]
  isPublished: boolean
}

export interface GalleryImage {
  id: string
  /** mediaType이 'video'면 영상 파일 URL */
  imageUrl: string
  caption?: string
  alt: string
  mediaType: 'image' | 'video'
  /** 영상 썸네일. 추출 실패 시 없을 수 있다 */
  posterUrl?: string
}

export interface GalleryAlbum {
  id: string
  title: string
  description?: string
  coverImgUrl: string
  eventDate: string
  images: GalleryImage[]
  /** 목록 카드 배지용 사진 수. 상세 조회 시에는 images.length로 대체 가능. */
  imageCount?: number
  isPublished: boolean
}

export type PostCategory = '공지' | '소식' | '행사'

export interface Post {
  id: string
  title: string
  content: string
  category: PostCategory
  isPinned: boolean
  publishedAt: string
  author?: string
}
