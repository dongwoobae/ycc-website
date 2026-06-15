import type { Post } from '@/lib/types'

const posts: Post[] = [
  {
    id: 'district-meeting-2026-06-07',
    title: '6월 7일 구역모임 및 구역장 세미나 안내',
    category: '공지',
    isPinned: true,
    publishedAt: '2026-06-07',
    content:
      '오늘 구역모임이 오후 1시에 있습니다. 구역 모임 후 오후 2시에 구역장 세미나로 모입니다. 각 구역은 정해진 장소에서 모여 주시기 바랍니다.',
  },
  {
    id: 'elected-training-2026',
    title: '피택자 교육 안내',
    category: '공지',
    isPinned: true,
    publishedAt: '2026-06-07',
    content:
      '피택자 교육이 오후 3시부터 5시까지 교육관 2층에서 진행됩니다. 한 분도 빠짐없이 참여해 주세요.',
  },
  {
    id: 'june-events-2026',
    title: '2026년 6월 교회행사',
    category: '소식',
    isPinned: false,
    publishedAt: '2026-06-01',
    content:
      '6월 교회행사는 전교인 금요기도회, 구역모임과 구역장 세미나, 1여전도회 헌신예배, 제직회와 교육위원회, 청춘교실 종강, 정기당회로 이어집니다.',
  },
  {
    id: 'family-month-movie',
    title: '가족의 달 특별 영화 관람을 마쳤습니다',
    category: '행사',
    isPinned: false,
    publishedAt: '2026-05-31',
    content:
      '가족의 달을 맞아 롯데시네마에서 영화 부흥을 함께 관람했습니다. 함께 기도하고 교제하는 시간이 되었습니다.',
  },
  {
    id: 'friday-prayer-june',
    title: '전교인 금요기도회 안내',
    category: '공지',
    isPinned: false,
    publishedAt: '2026-05-30',
    content:
      '6월 5일 금요일 오후 7시 30분 본당에서 전교인 금요기도회가 있습니다. 함께 모여 교회와 지역을 위해 기도합니다.',
  },
]

export async function getPosts(): Promise<Post[]> {
  return [...posts].sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.publishedAt.localeCompare(a.publishedAt))
}

export async function getPostById(id: string): Promise<Post | undefined> {
  return posts.find((post) => post.id === id)
}

export async function getLatestPosts(limit = 3): Promise<Post[]> {
  const sortedPosts = await getPosts()
  return sortedPosts.slice(0, limit)
}
