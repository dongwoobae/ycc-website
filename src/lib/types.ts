export type WorshipType = '주일예배' | '주일찬양예배' | '수요예배' | '금요기도회'

export interface Sermon {
  id: string
  title: string
  preacher: string
  scripture?: string
  worshipType: WorshipType
  sermonDate: string
  videoUrl: string
  youtubeId: string
  thumbnailUrl?: string
  summary?: string
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
    fax: string
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
