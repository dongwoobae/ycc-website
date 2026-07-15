import 'server-only'

import * as CFB from 'cfb'
import { inflateRawSync } from 'node:zlib'
import type { BulletinSection, BulletinTable } from '@/lib/types'

const paraHeaderTag = 66
const paraTextTag = 67
const ctrlHeaderTag = 71
const listHeaderTag = 72
const tableTag = 77
export const maxHwpDecompressedSize = 25 * 1024 * 1024

export interface HwpParseResult {
  paragraphs: string[]
  sections: BulletinSection[]
}

interface HwpRecord {
  tag: number
  level: number
  body: Buffer
}

interface TableCell {
  row: number
  col: number
  rowSpan: number
  colSpan: number
  lines: string[]
}

interface ParsedTable {
  nRows: number
  nCols: number
  cells: TableCell[]
  end: number
}

// 'break' marks the start of a source hwp table. Only four blocks in a bulletin carry
// a heading marker, so without it every table after the last marker piles into one
// section.
type ExtractedBlock =
  | { kind: 'prose'; lines: string[] }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'break' }

function isSectionPath(path: string) {
  return /(?:^|\/)BodyText\/Section\d+$/i.test(path)
}

function sectionNumber(path: string) {
  return Number(path.match(/Section(\d+)$/i)?.[1] ?? 0)
}

// Inline and extended controls span 8 WCHARs: the code, 12 bytes of info, then the
// code again. The info holds the control id ("tbl ", "gso " 등) as a little-endian
// DWORD, which decodes to text-range characters, so the whole run has to be skipped.
const wideControlCodes = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23])
const wideControlLength = 8

export function stripControls(value: string) {
  let output = ''
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (wideControlCodes.has(code)) {
      index += wideControlLength - 1
      continue
    }
    if (code === 10 || code === 13) output += '\n'
    else if (code >= 32) output += value[index]
  }
  return output
}

function readRecords(data: Buffer) {
  const records: HwpRecord[] = []
  let offset = 0

  while (offset + 4 <= data.length) {
    const start = offset
    const header = data.readUInt32LE(offset)
    const tag = header & 0x3ff
    const level = (header >>> 10) & 0x3ff
    let size = (header >>> 20) & 0xfff
    offset += 4

    if (size === 0xfff) {
      if (offset + 4 > data.length) break
      size = data.readUInt32LE(offset)
      offset += 4
    }

    if (offset + size > data.length || offset <= start) break
    records.push({ tag, level, body: data.subarray(offset, offset + size) })
    offset += size
  }

  return records
}

function textOf(body: Buffer) {
  return stripControls(body.toString('utf-16le'))
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function ctrlId(body: Buffer) {
  if (body.length < 4) return ''
  return [...body.subarray(0, 4)].reverse().map((value) => String.fromCharCode(value)).join('')
}

function readCell(body: Buffer, nRows: number, nCols: number) {
  if (body.length < 24) return null
  const col = body.readUInt16LE(8)
  const row = body.readUInt16LE(10)
  const colSpan = body.readUInt16LE(12)
  const rowSpan = body.readUInt16LE(14)
  if (row >= nRows || col >= nCols) return null
  if (colSpan < 1 || rowSpan < 1 || row + rowSpan > nRows || col + colSpan > nCols) return null
  return { row, col, rowSpan, colSpan, lines: [] } satisfies TableCell
}

function parseTable(records: HwpRecord[], start: number) {
  const ctrl = records[start]
  const table = records[start + 1]
  if (!ctrl || !table) return null

  const innerLevel = ctrl.level + 1
  if (table.tag !== tableTag || table.level !== innerLevel || table.body.length < 8) return null

  const nRows = table.body.readUInt16LE(4)
  const nCols = table.body.readUInt16LE(6)
  const cells: TableCell[] = []
  let currentCell: TableCell | null = null
  let index = start + 2

  for (; index < records.length; index += 1) {
    const record = records[index]
    if (record.level <= ctrl.level) break
    if (record.level !== innerLevel) continue

    if (record.tag === listHeaderTag) {
      currentCell = readCell(record.body, nRows, nCols)
      if (currentCell) cells.push(currentCell)
      continue
    }

    if (record.tag === paraHeaderTag && currentCell) {
      const text = records[index + 1]
      if (text?.tag === paraTextTag && text.level === innerLevel + 1) currentCell.lines.push(...textOf(text.body))
    }
  }

  return { nRows, nCols, cells, end: index } satisfies ParsedTable
}

function flattenTable(table: ParsedTable) {
  const byRow = new Map<number, TableCell[]>()
  for (const cell of table.cells) {
    const rowCells = byRow.get(cell.row) ?? []
    rowCells.push(cell)
    byRow.set(cell.row, rowCells)
  }

  const blocks: ({ kind: 'row'; cells: string[] } | ExtractedBlock)[] = []
  for (const row of [...byRow.keys()].sort((a, b) => a - b)) {
    const occupied = (byRow.get(row) ?? []).filter((cell) => cell.lines.length).sort((a, b) => a.col - b.col)
    if (occupied.length === 0) continue
    if (occupied.length === 1) blocks.push({ kind: 'prose', lines: occupied[0].lines })
    else blocks.push({ kind: 'row', cells: occupied.map((cell) => cell.lines.join(' ')) })
  }

  const output: ExtractedBlock[] = []
  for (const block of blocks) {
    const last = output.at(-1)
    if (block.kind === 'row' && last?.kind === 'table' && last.rows[0]?.length === block.cells.length) last.rows.push(block.cells)
    else if (block.kind === 'row') output.push({ kind: 'table', rows: [block.cells] })
    else output.push(block)
  }
  return output
}

export function inflateHwpSection(raw: Buffer, maxOutputLength = maxHwpDecompressedSize) {
  return inflateRawSync(raw, { maxOutputLength })
}

// \u{f0076} is the private-use glyph the bulletin template uses as a heading bullet.
const headingMarker = /^\s*[＊*◼■●\u{f0076}]/u
const offeringKeyword = /헌금|십일조/
// Bank accounts only: a phone number such as 054-337-4185 must not match, or the
// church contact table would be dropped as sensitive.
const bankName = /농협|국민|신한|우리|기업|하나|카카오|새마을|우체국|수협|경남|대구|부산/
const accountPattern = /\d{4,6}-\d{2,4}-\d{5,7}/

function isHeading(line: string) {
  return headingMarker.test(line)
}

function isOfferingHeading(line: string) {
  return isHeading(line) && offeringKeyword.test(line.replace(/\s+/g, ''))
}

function isSensitiveTable(rows: string[][]) {
  return rows.some((row) =>
    row.some((cell) => {
      const normalized = cell.replace(/\s+/g, '')
      if (/헌금|십일조|계좌/.test(normalized)) return true
      return accountPattern.test(cell) && bankName.test(cell)
    }),
  )
}

function stripOfferingBlocks(blocks: ExtractedBlock[]) {
  const kept: ExtractedBlock[] = []
  let inOffering = false

  for (const block of blocks) {
    // A break carries no text, and an offering block must survive it: resetting here
    // would republish names whenever the block ran to the end of its table.
    if (block.kind === 'break') {
      kept.push(block)
      continue
    }

    if (block.kind === 'table') {
      if (!inOffering && !isSensitiveTable(block.rows)) kept.push(block)
      continue
    }

    const firstLine = block.lines[0] ?? ''
    if (isOfferingHeading(firstLine)) inOffering = true
    else if (inOffering && isHeading(firstLine)) inOffering = false
    if (!inOffering) kept.push(block)
  }

  return kept
}

function tableFromRows(title: string, rows: string[][]): BulletinTable {
  if (rows.length >= 2) return { title, headers: rows[0], rows: rows.slice(1) }
  return { title, headers: [], rows }
}

function sectionId(index: number, title: string) {
  const slug = title
    .replace(/^[＊*◼■●\u{f0076}]\s*/u, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-|-$/g, '')
  return slug || `section-${index}`
}

function blocksToSections(blocks: ExtractedBlock[]) {
  const sections: BulletinSection[] = []
  let current: BulletinSection | null = null
  let untitled = 0

  function start(title: string, body: string[] = []): BulletinSection {
    const section = { id: sectionId(sections.length + 1, title), title, body }
    sections.push(section)
    return section
  }

  for (const block of blocks) {
    // Close the section so the next table opens its own rather than piling up.
    if (block.kind === 'break') {
      current = null
      continue
    }

    if (block.kind === 'prose') {
      const [firstLine, ...rest] = block.lines
      if (!firstLine) continue
      // An unmarked paragraph opening a table still names what follows, so it titles
      // the section rather than becoming stray body text.
      if (isHeading(firstLine) || !current) current = start(firstLine, rest)
      else current.body = [...(current.body ?? []), ...block.lines]
      continue
    }

    if (!current) {
      untitled += 1
      current = start(`표 ${untitled}`)
    }
    current.tables = [...(current.tables ?? []), tableFromRows(current.title, block.rows)]
  }

  const used = new Set<string>()
  return sections
    .filter((section) => section.title && (section.body?.length || section.tables?.length))
    .map((section) => {
      // Sections titled alike would otherwise collide, and the editor keys on id.
      let id = section.id
      for (let n = 2; used.has(id); n += 1) id = `${section.id}-${n}`
      used.add(id)
      return {
        id,
        title: section.title,
        ...(section.body?.length ? { body: section.body } : {}),
        ...(section.tables?.length ? { tables: section.tables } : {}),
      }
    })
}

/**
 * Drops the donor lists and offering account from extracted paragraphs.
 *
 * Bulletins open with offering blocks, each headed by a marker and running until
 * the next non-offering heading. Names sometimes sit on the heading line itself.
 */
export function stripOfferingParagraphs(paragraphs: string[]) {
  const kept: string[] = []
  let inOffering = false

  for (const line of paragraphs) {
    if (isOfferingHeading(line)) inOffering = true
    else if (inOffering && isHeading(line)) inOffering = false
    if (!inOffering) kept.push(line)
  }

  return kept
}

export function parseHwpSection(data: Buffer): HwpParseResult {
  const records = readRecords(data)
  const blocks: ExtractedBlock[] = []

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    if (record.tag === ctrlHeaderTag && ctrlId(record.body) === 'tbl ') {
      const table = parseTable(records, index)
      if (table) {
        blocks.push({ kind: 'break' }, ...flattenTable(table))
        index = table.end - 1
      }
      continue
    }

    if (record.tag === paraTextTag) {
      const lines = textOf(record.body)
      if (lines.length) blocks.push({ kind: 'prose', lines })
    }
  }

  const filtered = stripOfferingBlocks(blocks)
  return {
    paragraphs: filtered.flatMap((block) => (block.kind === 'prose' ? block.lines : [])),
    sections: blocksToSections(filtered),
  }
}

export function parseHwp(buffer: Buffer): HwpParseResult {
  const cfb = CFB.read(buffer, { type: 'buffer' })
  const header = CFB.find(cfb, 'FileHeader')?.content
  if (!header || header.length < 37) throw new Error('유효한 hwp 5.0 파일이 아닙니다')

  const compressed = (Buffer.from(header)[36] & 1) !== 0
  const sectionEntries = cfb.FullPaths.map((path, index) => ({ path, entry: cfb.FileIndex[index] }))
    .filter(({ path, entry }) => isSectionPath(path) && !!entry?.content)
    .sort((a, b) => sectionNumber(a.path) - sectionNumber(b.path))

  if (sectionEntries.length === 0) throw new Error('유효한 hwp 5.0 파일이 아닙니다')

  const paragraphs: string[] = []
  const sections: BulletinSection[] = []
  for (const { entry } of sectionEntries) {
    try {
      const raw = Buffer.from(entry.content)
      if (!compressed && raw.length > maxHwpDecompressedSize) throw new Error('hwp section is too large')
      const data = compressed ? inflateHwpSection(raw) : raw
      const parsed = parseHwpSection(data)
      paragraphs.push(...parsed.paragraphs)
      sections.push(...parsed.sections)
    } catch {
      continue
    }
  }

  if (paragraphs.length === 0 && sections.length === 0) throw new Error('hwp 본문을 추출할 수 없습니다')
  return { paragraphs: stripOfferingParagraphs(paragraphs), sections }
}
