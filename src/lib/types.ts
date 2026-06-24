export type WorshipType =
  | '주일예배' | '주일찬양예배' | '수요예배' | '금요기도회'
  | '시온찬양대' | '특송' | '특별행사' | '미분류'

export interface SermonChapter {
  startSeconds: number
  title: string
  summary: string
}

export interface Sermon {
  id: string
  title: string
  preacher?: string
  scripture?: string
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
  summaryStatus: 'none' | 'pending' | 'ready' | 'failed'
  isPublished: boolean
}

export interface BulletinTable {
  title: string
  headers: string[]
  rows: string[][]
}

export interface BulletinOffering {
  category: string
  names: string[]
}

export interface BulletinSection {
  id: string
  title: string
  body?: string[]
  rows?: { label: string; value: string }[]
  tables?: BulletinTable[]
  offerings?: BulletinOffering[]
}

export interface Bulletin {
  id: string
  bulletinDate: string
  volume: string
  issue: string
  theme: string
  scripture: string
  churchInfo: {
    address: string
    phone: string
    phone2?: string
    blog: string
  }
  sections: BulletinSection[]
  isPublished: boolean
}

export interface GalleryImage {
  id: string
  imageUrl: string
  caption?: string
  alt: string
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
}
