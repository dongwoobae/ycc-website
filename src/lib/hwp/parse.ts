import 'server-only'

import * as CFB from 'cfb'
import { inflateRawSync } from 'node:zlib'

const paraTextTag = 67
export const maxHwpDecompressedSize = 25 * 1024 * 1024

export interface HwpParseResult {
  paragraphs: string[]
}

function isSectionPath(path: string) {
  return /(?:^|\/)BodyText\/Section\d+$/i.test(path)
}

function sectionNumber(path: string) {
  return Number(path.match(/Section(\d+)$/i)?.[1] ?? 0)
}

// Inline and extended controls span 8 WCHARs: the code, 12 bytes of info, then the
// code again. The info holds the control id ("tbl ", "gso " …) as a little-endian
// DWORD, which decodes to text-range characters, so the whole run has to be skipped
// rather than just the leading code. Everything else below 0x20 is one WCHAR wide.
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

function parseSection(data: Buffer) {
  const lines: string[] = []
  let offset = 0

  while (offset + 4 <= data.length) {
    const start = offset
    const header = data.readUInt32LE(offset)
    const tag = header & 0x3ff
    let size = (header >>> 20) & 0xfff
    offset += 4

    if (size === 0xfff) {
      if (offset + 4 > data.length) break
      size = data.readUInt32LE(offset)
      offset += 4
    }

    if (size === 0 || offset + size > data.length || offset <= start) break
    const body = data.subarray(offset, offset + size)
    offset += size

    if (tag !== paraTextTag) continue
    const text = stripControls(body.toString('utf-16le')).trim()
    if (text) lines.push(...text.split(/\n+/).map((line) => line.trim()).filter(Boolean))
  }

  return lines
}

export function inflateHwpSection(raw: Buffer, maxOutputLength = maxHwpDecompressedSize) {
  return inflateRawSync(raw, { maxOutputLength })
}

const headingMarker = /^[＊*◼■●]/
const offeringKeyword = /헌금|십일조/

function isHeading(line: string) {
  return headingMarker.test(line)
}

function isOfferingHeading(line: string) {
  return isHeading(line) && offeringKeyword.test(line.replace(/\s+/g, ''))
}

/**
 * Drops the donor lists and offering account from extracted paragraphs.
 *
 * Bulletins open with 헌금 blocks (십일조·감사헌금·맥추감사헌금 …), each headed by a
 * marker and running until the next non-offering heading. Names sometimes sit on the
 * heading line itself, and the 헌금계좌번호 lines carry no marker, so the block is cut
 * by its boundaries rather than by matching category names or name-shaped text — the
 * category set varies week to week.
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

export function parseHwp(buffer: Buffer): HwpParseResult {
  const cfb = CFB.read(buffer, { type: 'buffer' })
  const header = CFB.find(cfb, 'FileHeader')?.content
  if (!header || header.length < 37) throw new Error('유효한 hwp 5.0 아님')

  const compressed = (Buffer.from(header)[36] & 1) !== 0
  const sections = cfb.FullPaths.map((path, index) => ({ path, entry: cfb.FileIndex[index] }))
    .filter(({ path, entry }) => isSectionPath(path) && !!entry?.content)
    .sort((a, b) => sectionNumber(a.path) - sectionNumber(b.path))

  if (sections.length === 0) throw new Error('유효한 hwp 5.0 아님')

  const paragraphs: string[] = []
  for (const { entry } of sections) {
    try {
      const raw = Buffer.from(entry.content)
      if (!compressed && raw.length > maxHwpDecompressedSize) throw new Error('hwp section is too large')
      const data = compressed ? inflateHwpSection(raw) : raw
      paragraphs.push(...parseSection(data))
    } catch {
      continue
    }
  }

  if (paragraphs.length === 0) throw new Error('hwp 본문을 추출할 수 없습니다')
  return { paragraphs: stripOfferingParagraphs(paragraphs) }
}
