import { describe, expect, it } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { inflateHwpSection, parseHwpSection, stripControls, stripOfferingParagraphs } from './parse'

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

const PARA_HEADER = 66
const PARA_TEXT = 67
const CTRL_HEADER = 71
const LIST_HEADER = 72
const TABLE = 77

function record(tag: number, level: number, body = Buffer.alloc(0)) {
  const header = Buffer.alloc(4)
  header.writeUInt32LE(tag | (level << 10) | (body.length << 20))
  return Buffer.concat([header, body])
}

function textRecord(level: number, lines: string[]) {
  return record(PARA_TEXT, level, Buffer.from(lines.join(String.fromCharCode(10)), 'utf-16le'))
}

function tableControl() {
  return record(CTRL_HEADER, 1, Buffer.from(' lbt', 'latin1'))
}

function tableHeader(nRows: number, nCols: number) {
  const body = Buffer.alloc(8)
  body.writeUInt16LE(nRows, 4)
  body.writeUInt16LE(nCols, 6)
  return record(TABLE, 2, body)
}

function listHeader(level: number, row: number, col: number, rowSpan = 1, colSpan = 1, size = 47) {
  const body = Buffer.alloc(size)
  body.writeUInt32LE(1, 0)
  body.writeUInt16LE(col, 8)
  body.writeUInt16LE(row, 10)
  body.writeUInt16LE(colSpan, 12)
  body.writeUInt16LE(rowSpan, 14)
  return record(LIST_HEADER, level, body)
}

function cell(row: number, col: number, lines: string[], rowSpan = 1, colSpan = 1) {
  return [listHeader(2, row, col, rowSpan, colSpan), record(PARA_HEADER, 2), textRecord(3, lines)]
}

function sectionRecords(records: Buffer[]) {
  return Buffer.concat(records)
}

describe('parseHwpSection tables', () => {
  it('flattens a coordinate table into prose and equal-width table blocks', () => {
    const parsed = parseHwpSection(
      sectionRecords([
        record(PARA_HEADER, 0),
        tableControl(),
        tableHeader(7, 11),
        ...cell(0, 0, ['＊ 지난주 출석현황'], 1, 11),
        ...cell(1, 0, ['구분']),
        ...cell(1, 1, ['장년']),
        ...cell(1, 2, ['합계']),
        ...cell(2, 0, ['인원']),
        ...cell(2, 1, ['100']),
        ...cell(2, 2, ['120']),
        ...cell(4, 0, ['＊ 7월 섬기는 청지기'], 1, 11),
        ...cell(5, 0, ['주차']),
        ...cell(5, 3, ['기도'], 1, 3),
        ...cell(6, 0, ['1주']),
        ...cell(6, 3, ['담당자'], 1, 3),
      ]),
    )

    expect(parsed.sections).toMatchObject([
      {
        title: '＊ 지난주 출석현황',
        tables: [{ headers: ['구분', '장년', '합계'], rows: [['인원', '100', '120']] }],
      },
      {
        title: '＊ 7월 섬기는 청지기',
        tables: [{ headers: ['주차', '기도'], rows: [['1주', '담당자']] }],
      },
    ])
  })

  it('rejects non-cell list headers even when they appear inside a table subtree', () => {
    const parsed = parseHwpSection(
      sectionRecords([
        record(PARA_HEADER, 0),
        tableControl(),
        tableHeader(1, 2),
        listHeader(3, 0, 0, 1, 1, 33),
        record(PARA_HEADER, 3),
        textRecord(4, ['캡션']),
        ...cell(0, 0, ['A']),
        ...cell(0, 1, ['B']),
      ]),
    )

    expect(parsed.sections[0]?.tables?.[0]).toMatchObject({ headers: [], rows: [['A', 'B']] })
    expect(parsed.paragraphs).not.toContain('캡션')
  })

  it('drops offering prose blocks and account tables before section assembly', () => {
    const parsed = parseHwpSection(
      sectionRecords([
        record(PARA_HEADER, 0),
        tableControl(),
        tableHeader(4, 2),
        ...cell(0, 0, ['＊ 십 일 조', '가나다 라마바'], 1, 2),
        ...cell(1, 0, ['헌금계좌번호']),
        ...cell(1, 1, ['00-0000-000000']),
        ...cell(2, 0, ['＊ 7월 섬기는 청지기'], 1, 2),
        ...cell(3, 0, ['주차']),
        ...cell(3, 1, ['봉사']),
      ]),
    )

    expect(parsed.paragraphs).toEqual(['＊ 7월 섬기는 청지기'])
    expect(parsed.sections).toMatchObject([
      { title: '＊ 7월 섬기는 청지기', tables: [{ headers: [], rows: [['주차', '봉사']] }] },
    ])
  })

  // Only a handful of paragraphs carry a heading marker, so without a break at each
  // source table every later table would land in the last marked section.
  it('starts a new section at each source table even without a heading', () => {
    const parsed = parseHwpSection(
      sectionRecords([
        record(PARA_HEADER, 0),
        tableControl(),
        tableHeader(1, 2),
        ...cell(0, 0, ['가']),
        ...cell(0, 1, ['나']),
        record(PARA_HEADER, 0),
        tableControl(),
        tableHeader(1, 2),
        ...cell(0, 0, ['다']),
        ...cell(0, 1, ['라']),
      ]),
    )

    expect(parsed.sections).toMatchObject([
      { title: '표 1', tables: [{ rows: [['가', '나']] }] },
      { title: '표 2', tables: [{ rows: [['다', '라']] }] },
    ])
  })

  it('titles a section from an unmarked paragraph opening its table', () => {
    const parsed = parseHwpSection(
      sectionRecords([
        record(PARA_HEADER, 0),
        tableControl(),
        tableHeader(2, 2),
        ...cell(0, 0, ['교회학교 예배 및 순서'], 1, 2),
        ...cell(1, 0, ['부서']),
        ...cell(1, 1, ['시간']),
      ]),
    )

    expect(parsed.sections).toMatchObject([
      { title: '교회학교 예배 및 순서', tables: [{ rows: [['부서', '시간']] }] },
    ])
  })

  it('keeps section ids unique when two sections share a title', () => {
    const table = (line: string) => [
      record(PARA_HEADER, 0),
      tableControl(),
      tableHeader(2, 2),
      ...cell(0, 0, ['◼ 알림'], 1, 2),
      ...cell(1, 0, [line]),
      ...cell(1, 1, ['값']),
    ]
    const parsed = parseHwpSection(sectionRecords([...table('하나'), ...table('둘')]))

    expect(parsed.sections).toHaveLength(2)
    expect(parsed.sections[0].title).toBe(parsed.sections[1].title)
    expect(parsed.sections[0].id).not.toBe(parsed.sections[1].id)
  })
})
