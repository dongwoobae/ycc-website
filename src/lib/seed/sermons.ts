import type { Sermon, WorshipType } from '@/lib/types'

function youtubeIdFromUrl(videoUrl: string) {
  const url = new URL(videoUrl)
  if (url.hostname === 'youtu.be') return url.pathname.slice(1)
  return url.searchParams.get('v') ?? ''
}

function sermon(input: Omit<Sermon, 'youtubeId' | 'thumbnailUrl' | 'isPublished'>): Sermon {
  const youtubeId = youtubeIdFromUrl(input.videoUrl)
  return {
    ...input,
    youtubeId,
    thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
    isPublished: true,
  }
}

const sermons: Sermon[] = [
  sermon({
    id: '2026-06-07-sunday',
    title: '[재정] 마음의 무게 중심',
    preacher: '김선찬 목사',
    scripture: '마태복음 6장 19~24절',
    worshipType: '주일예배',
    sermonDate: '2026-06-07',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    summary: '보물이 있는 곳에 마음도 있음을 기억하며 하나님 나라의 가치에 중심을 두자는 말씀입니다.',
  }),
  sermon({
    id: '2026-06-10-wednesday',
    title: '[공공성] 믿음은 나만의 것이 아닙니다',
    preacher: '김선찬 목사',
    scripture: '마태복음 5장 13~16절',
    worshipType: '수요예배',
    sermonDate: '2026-06-10',
    videoUrl: 'https://www.youtube.com/watch?v=ysz5S6PUM-U',
    summary: '소금과 빛으로 부름받은 성도의 삶이 교회 밖 이웃에게 닿아야 함을 나눕니다.',
  }),
  sermon({
    id: '2026-05-31-sunday',
    title: '[대화] 불통, 소통, 유통',
    preacher: '김선찬 목사',
    scripture: '이사야 55장 10~11절',
    worshipType: '주일예배',
    sermonDate: '2026-05-31',
    videoUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    summary: '하나님의 말씀은 헛되이 돌아오지 않으며 삶 가운데 흘러가 열매 맺습니다.',
  }),
  sermon({
    id: '2026-06-05-friday',
    title: '막힌 발걸음, 흐르는 말씀',
    preacher: '김선찬 목사',
    scripture: '데살로니가전서 2장 18절',
    worshipType: '금요기도회',
    sermonDate: '2026-06-05',
    videoUrl: 'https://www.youtube.com/watch?v=oHg5SJYRHA0',
    summary: '막힘 속에서도 말씀은 멈추지 않고 성도의 기도를 통해 길을 엽니다.',
  }),
  sermon({
    id: '2026-06-14-praise',
    title: '헌신은 은혜의 응답입니다',
    preacher: '김선찬 목사',
    scripture: '로마서 12장 1~2절',
    worshipType: '주일찬양예배',
    sermonDate: '2026-06-14',
    videoUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    summary: '몸과 마음을 하나님께 드리는 예배가 일상의 헌신으로 이어집니다.',
  }),
  sermon({
    id: '2026-06-17-wednesday',
    title: '작은 순종이 길을 만듭니다',
    preacher: '김선찬 목사',
    scripture: '야고보서 2장 14~18절',
    worshipType: '수요예배',
    sermonDate: '2026-06-17',
    videoUrl: 'https://www.youtube.com/watch?v=ScMzIvxBSi4',
    summary: '믿음은 말에 머물지 않고 작지만 구체적인 순종으로 드러납니다.',
  }),
  sermon({
    id: '2026-06-21-sunday',
    title: '교회를 세우는 한 마음',
    preacher: '김선찬 목사',
    scripture: '에베소서 4장 1~6절',
    worshipType: '주일예배',
    sermonDate: '2026-06-21',
    videoUrl: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
    summary: '부르심에 합당하게 행하며 성령 안에서 하나 됨을 힘써 지키는 교회가 됩니다.',
  }),
]

export async function getSermons(): Promise<Sermon[]> {
  return sermons
}

export async function getSermonById(id: string): Promise<Sermon | undefined> {
  return sermons.find((sermonItem) => sermonItem.id === id)
}

export async function getSermonsByWorshipType(worshipType?: WorshipType): Promise<Sermon[]> {
  if (!worshipType) return sermons
  return sermons.filter((sermonItem) => sermonItem.worshipType === worshipType)
}

export async function getLatestSermons(limit = 3): Promise<Sermon[]> {
  return sermons.slice(0, limit)
}
