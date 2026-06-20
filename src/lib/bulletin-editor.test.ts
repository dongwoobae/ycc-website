import { describe, expect, it } from 'vitest'
import { formatTableCells, normalizeBodyLines, normalizeBulletinInput, parseBodyLines, parseTableRows } from './bulletin-editor'

describe('parseBodyLines', () => {
  it('normalizes an empty textarea to no body lines', () => {
    expect(parseBodyLines('')).toEqual([])
  })

  it('drops empty trailing lines while preserving intentional blank lines', () => {
    expect(parseBodyLines('first\n\nsecond\n')).toEqual(['first', '', 'second'])
    expect(normalizeBodyLines(['first', '', ''])).toEqual(['first'])
  })
})

describe('table helpers', () => {
  it('validates expected table column counts', () => {
    expect(parseTableRows(['a\tb', 'c\td'], 2)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
    expect(() => parseTableRows(['a\tb', 'c'], 2)).toThrow('2 columns')
  })

  it('rejects embedded tab and line break characters inside cells before serialization', () => {
    expect(() => formatTableCells(['a\tb', 'c'])).toThrow('tabs')
    expect(() => formatTableCells(['a\nb', 'c'])).toThrow('line breaks')
  })

  it('normalizes bulletin tables at submit time', () => {
    const normalized = normalizeBulletinInput({
      bulletinDate: '2026-06-20',
      volume: '',
      issue: '',
      theme: '',
      scripture: '',
      sections: [
        {
          id: 'section-1',
          title: 'Section',
          body: ['line', ''],
          tables: [{ title: 'Table', headers: ['A', 'B', ''], rows: [['1', '2']] }],
        },
      ],
    })

    expect(normalized.sections[0]?.body).toEqual(['line'])
    expect(normalized.sections[0]?.tables?.[0]?.headers).toEqual(['A', 'B'])
    expect(normalized.sections[0]?.tables?.[0]?.rows).toEqual([['1', '2']])
  })
})
