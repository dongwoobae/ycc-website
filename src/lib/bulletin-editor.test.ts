import { describe, expect, it } from 'vitest'
import { normalizeBulletinInput, normalizeNotices, normalizePages } from './bulletin-editor'
import type { BulletinFormInput } from '@/lib/actions/bulletins'

const page = {
  width: 1414,
  height: 2000,
  fullUrl: 'https://cdn.example.com/bulletins/2026-07-26/u/1-full.webp',
  previewUrl: 'https://cdn.example.com/bulletins/2026-07-26/u/1-preview.webp',
  thumbUrl: 'https://cdn.example.com/bulletins/2026-07-26/u/1-thumb.webp',
}

describe('normalizeNotices', () => {
  it('앞뒤 공백을 지운다', () => {
    expect(normalizeNotices([{ title: '  여름성경학교 ', detail: ' 교육관 1층  ', when: ' 토 09:00 ' }])).toEqual([
      { title: '여름성경학교', detail: '교육관 1층', when: '토 09:00' },
    ])
  })

  it('when이 비면 키 자체를 뺀다 — 배지 분기가 undefined 하나만 보게 한다', () => {
    expect(normalizeNotices([{ title: '새가족 등록', detail: '3명', when: '   ' }])).toEqual([
      { title: '새가족 등록', detail: '3명' },
    ])
  })

  it('제목과 내용이 모두 비면 버린다', () => {
    expect(normalizeNotices([{ title: '  ', detail: '  ', when: '월 10:00' }])).toEqual([])
  })

  it('제목만 있어도 남긴다', () => {
    expect(normalizeNotices([{ title: '구역예배', detail: '' }])).toEqual([{ title: '구역예배', detail: '' }])
  })
})

describe('normalizePages', () => {
  it('정상 면은 그대로 통과시킨다', () => {
    expect(normalizePages([page])).toEqual([page])
  })

  it('세 URL 중 하나라도 비면 버린다', () => {
    expect(normalizePages([{ ...page, thumbUrl: '' }])).toEqual([])
    expect(normalizePages([{ ...page, previewUrl: '   ' }])).toEqual([])
  })

  it('폭·높이가 0 이하이거나 숫자가 아니면 버린다', () => {
    expect(normalizePages([{ ...page, width: 0 }])).toEqual([])
    expect(normalizePages([{ ...page, height: Number.NaN }])).toEqual([])
  })
})

describe('normalizeBulletinInput', () => {
  const input: BulletinFormInput = {
    bulletinDate: '2026-07-26',
    volume: ' 제12권 ',
    issue: ' 30호 ',
    sermonTitle: ' 흔들리지 않는 반석 위에 ',
    scripture: ' 마태복음 7:24-27 ',
    preacher: ' 김선찬 담임목사 ',
    hymns: ' 새 210장 · 통 40장 ',
    responsiveReading: ' 32번 ',
    nextWeek: '  ',
    pdfUrl: '   ',
    notices: [{ title: ' 구역예배 ', detail: ' 목 19:30 ', when: '' }],
    pages: [page, { ...page, fullUrl: '' }],
  }

  it('모든 스칼라를 trim한다', () => {
    const result = normalizeBulletinInput(input)
    expect(result.volume).toBe('제12권')
    expect(result.sermonTitle).toBe('흔들리지 않는 반석 위에')
    expect(result.preacher).toBe('김선찬 담임목사')
  })

  it('빈 nextWeek는 빈 문자열로 남긴다', () => {
    expect(normalizeBulletinInput(input).nextWeek).toBe('')
  })

  it('빈 pdfUrl은 undefined로 만든다', () => {
    expect(normalizeBulletinInput(input).pdfUrl).toBeUndefined()
  })

  it('공지와 면을 정규화해 넘긴다', () => {
    const result = normalizeBulletinInput(input)
    expect(result.notices).toEqual([{ title: '구역예배', detail: '목 19:30' }])
    expect(result.pages).toEqual([page])
  })

  it('bulletinDate는 건드리지 않는다', () => {
    expect(normalizeBulletinInput(input).bulletinDate).toBe('2026-07-26')
  })
})
