import { describe, expect, it, vi } from 'vitest'
import { composeThumbnailText } from './compose-text'

const sermon = {
  title: '원제목',
  displayTitle: '새 사람의 DNA',
  summary: '변화된 삶 (고린도후서 5:17)',
  quickSummary: ['포인트1', '포인트2'],
}

describe('composeThumbnailText', () => {
  it('정통형: displayTitle + 추출 구절', async () => {
    const r = await composeThumbnailText('classic', sermon, vi.fn())
    expect(r).toEqual({ headline: '새 사람의 DNA', scripture: '고린도후서 5:17' })
  })

  it('인물컷형: 정통형과 동일하게 채운다', async () => {
    const r = await composeThumbnailText('cutout', sermon, vi.fn())
    expect(r).toEqual({ headline: '새 사람의 DNA', scripture: '고린도후서 5:17' })
  })

  it('displayTitle 없으면 title 사용', async () => {
    const r = await composeThumbnailText('classic', { ...sermon, displayTitle: null }, vi.fn())
    expect(r.headline).toBe('원제목')
  })

  it('후킹형: headlineFn 결과를 headline으로 사용', async () => {
    const headlineFn = vi.fn().mockResolvedValue('이게 진짜 복입니다')
    const r = await composeThumbnailText('hook', sermon, headlineFn)
    expect(headlineFn).toHaveBeenCalledWith(sermon)
    expect(r).toEqual({ headline: '이게 진짜 복입니다', scripture: '고린도후서 5:17' })
  })
})
