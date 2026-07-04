import type { GalleryAlbum } from '@/lib/types'

const albums: GalleryAlbum[] = [
  {
    id: '2026-spring-service',
    title: '봄맞이 교회 대청소',
    description: '성도들이 함께 예배당과 교육관을 정돈하며 새 계절을 맞이했습니다.',
    coverImgUrl: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1200&q=80',
    eventDate: '2026-04-18',
    isPublished: true,
    images: [
      {
        id: 'spring-service-1',
        imageUrl: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1200&q=80',
        alt: '햇빛이 드는 교회 내부',
        caption: '예배당 정돈',
        mediaType: 'image',
      },
      {
        id: 'spring-service-2',
        imageUrl: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80',
        alt: '함께 모인 사람들',
        caption: '봉사 후 나눔',
        mediaType: 'image',
      },
      {
        id: 'spring-service-3',
        imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
        alt: '밝게 웃는 공동체',
        caption: '함께하는 기쁨',
        mediaType: 'image',
      },
    ],
  },
  {
    id: '2026-youth-retreat',
    title: '청년부 말씀 수련회',
    description: '말씀과 기도로 서로를 격려하며 믿음의 걸음을 새롭게 했습니다.',
    coverImgUrl: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=80',
    eventDate: '2026-05-16',
    isPublished: true,
    images: [
      {
        id: 'youth-retreat-1',
        imageUrl: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=80',
        alt: '청년들이 모인 실내 모임',
        caption: '말씀 나눔',
        mediaType: 'image',
      },
      {
        id: 'youth-retreat-2',
        imageUrl: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1200&q=80',
        alt: '공동체 모임',
        caption: '기도와 교제',
        mediaType: 'image',
      },
      {
        id: 'youth-retreat-3',
        imageUrl: 'https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=1200&q=80',
        alt: '책상 위 성경책',
        caption: '말씀 묵상',
        mediaType: 'image',
      },
    ],
  },
  {
    id: '2026-family-movie',
    title: '가족의 달 영화 관람',
    description: '가정의 달을 맞아 함께 영화를 보고 교제하는 시간을 가졌습니다.',
    coverImgUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80',
    eventDate: '2026-05-31',
    isPublished: true,
    images: [
      {
        id: 'family-movie-1',
        imageUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80',
        alt: '영화관 좌석',
        caption: '영화 관람',
        mediaType: 'image',
      },
      {
        id: 'family-movie-2',
        imageUrl: 'https://images.unsplash.com/photo-1505236858219-8359eb29e329?auto=format&fit=crop&w=1200&q=80',
        alt: '함께 걷는 사람들',
        caption: '가족 교제',
        mediaType: 'image',
      },
    ],
  },
]

export async function getGalleryAlbums(): Promise<GalleryAlbum[]> {
  return albums
}

export async function getGalleryAlbumById(id: string): Promise<GalleryAlbum | undefined> {
  return albums.find((album) => album.id === id)
}
