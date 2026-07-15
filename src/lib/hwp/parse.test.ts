import { describe, expect, it } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { inflateHwpSection, stripControls, stripOfferingParagraphs } from './parse'

describe('inflateHwpSection', () => {
  it('rejects decompressed output above the configured cap', () => {
    const compressed = deflateRawSync(Buffer.alloc(128, 'a'))

    expect(() => inflateHwpSection(compressed, 64)).toThrow()
  })
})

const lineBreak = String.fromCharCode(10)
const paragraphBreak = String.fromCharCode(13)
const hyphen = String.fromCharCode(24)
const fixedWidthSpace = String.fromCharCode(30)

// Builds a control the way hwp stores it: the code, 12 bytes of info carrying the
// control id as a little-endian DWORD, then the code again — 8 WCHARs in total.
function control(code: number, id: string) {
  const info = Buffer.alloc(12)
  info.write([...id].reverse().join(''), 0, 'latin1')
  return String.fromCharCode(code) + info.toString('utf-16le') + String.fromCharCode(code)
}

describe('stripControls', () => {
  it('drops the id of a table control instead of leaking it as text', () => {
    expect(stripControls(`앞${control(11, 'tbl ')}뒤`)).toBe('앞뒤')
  })

  it('drops every control id found in a section opener', () => {
    const opener = control(2, 'secd') + control(2, 'cold') + control(11, 'tbl ')

    expect(stripControls(opener)).toBe('')
  })

  it('keeps text around a drawing object control', () => {
    expect(stripControls(`＊ 지난주 출석현황${control(11, 'gso ')}`)).toBe('＊ 지난주 출석현황')
  })

  it('maps line and paragraph breaks to newlines', () => {
    const text = `가${paragraphBreak}나${lineBreak}다`

    expect(stripControls(text).split(lineBreak)).toEqual(['가', '나', '다'])
  })

  it('drops single-wchar controls without consuming neighbouring text', () => {
    // Unlike table and drawing controls these span one WCHAR, so the characters
    // right after them must survive.
    expect(stripControls(`가${hyphen}나${fixedWidthSpace}다`)).toBe('가나다')
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
