import 'server-only'

import * as CFB from 'cfb'
import { inflateRawSync } from 'node:zlib'

const paraTextTag = 67

export interface HwpParseResult {
  paragraphs: string[]
}

function isSectionPath(path: string) {
  return /(?:^|\/)BodyText\/Section\d+$/i.test(path)
}

function sectionNumber(path: string) {
  return Number(path.match(/Section(\d+)$/i)?.[1] ?? 0)
}

function stripControls(value: string) {
  let output = ''
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (code === 10 || code === 13) output += '\n'
    else if (code >= 32) output += char
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
      const data = compressed ? inflateRawSync(raw) : raw
      paragraphs.push(...parseSection(data))
    } catch {
      continue
    }
  }

  if (paragraphs.length === 0) throw new Error('hwp 본문을 추출할 수 없습니다')
  return { paragraphs }
}
