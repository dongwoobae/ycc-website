import { describe, expect, it } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { inflateHwpSection, stripOfferingParagraphs } from './parse'

describe('inflateHwpSection', () => {
  it('rejects decompressed output above the configured cap', () => {
    const compressed = deflateRawSync(Buffer.alloc(128, 'a'))

    expect(() => inflateHwpSection(compressed, 64)).toThrow()
  })
})

// Paragraph shapes mirror real bulletins; names are fabricated so donor data
// stays out of the repo.
describe('stripOfferingParagraphs', () => {
  it('drops an offering block and keeps the section that follows', () => {
    expect(
      stripOfferingParagraphs([
        '＊ 십 일 조',
        '가나다 라마바 사아자',
        '＊ 감사헌금',
        '차카타 파하가',
        '＊ 지난주 출석현황',
        '주일예배',
      ]),
    ).toEqual(['＊ 지난주 출석현황', '주일예배'])
  })

  it('drops offering categories that are not a known fixed set', () => {
    expect(
      stripOfferingParagraphs(['＊ 맥추감사헌금', '가나다 라마바', '＊ 지난주 출석현황']),
    ).toEqual(['＊ 지난주 출석현황'])
  })

  it('drops names sharing the heading paragraph', () => {
    expect(
      stripOfferingParagraphs(['＊ 건축헌금 가나다 라마바 사아자', '＊ 지난주 출석현황']),
    ).toEqual(['＊ 지난주 출석현황'])
  })

  it('drops the unmarked account lines trailing an offering block', () => {
    expect(
      stripOfferingParagraphs([
        '＊ 전도헌금',
        '가나다 라마바',
        '헌금계좌번호',
        '농협 000000-00-000000 영천중앙교회',
        '＊ 지난주 출석현황',
      ]),
    ).toEqual(['＊ 지난주 출석현황'])
  })

  it('keeps content preceding the first offering heading', () => {
    expect(stripOfferingParagraphs(['영천중앙교회 주보', '＊ 십 일 조', '가나다'])).toEqual([
      '영천중앙교회 주보',
    ])
  })

  it('ends an offering block at a heading using a different marker', () => {
    expect(stripOfferingParagraphs(['＊ 감사헌금', '가나다', '◼ 알림', '1. 오늘은'])).toEqual([
      '◼ 알림',
      '1. 오늘은',
    ])
  })

  it('leaves a bulletin without offerings untouched', () => {
    const paragraphs = ['＊ 지난주 출석현황', '주일예배', '110', '◼ 알림']

    expect(stripOfferingParagraphs(paragraphs)).toEqual(paragraphs)
  })
})
