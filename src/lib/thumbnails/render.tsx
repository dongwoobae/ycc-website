import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import type { ThumbnailText } from './types'

const WIDTH = 1280
const HEIGHT = 720

let fontCache: { bold: ArrayBuffer } | null = null

async function loadFonts() {
  if (fontCache) return fontCache
  const boldPath = path.join(
    process.cwd(),
    'node_modules/pretendard/dist/public/static/alternative/Pretendard-Bold.ttf'
  )
  const boldFile = await readFile(boldPath)
  const bold = boldFile.buffer.slice(boldFile.byteOffset, boldFile.byteOffset + boldFile.byteLength) as ArrayBuffer
  fontCache = { bold }
  return fontCache
}

export interface RenderInput extends ThumbnailText {
  backgroundDataUrl: string
  cutoutDataUrl?: string
}

export async function renderThumbnail(input: RenderInput): Promise<Buffer> {
  const { bold } = await loadFonts()
  const response = new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          position: 'relative',
          fontFamily: 'Pretendard',
        }}
      >
        <img
          src={input.backgroundDataUrl}
          width={WIDTH}
          height={HEIGHT}
          style={{ position: 'absolute', top: 0, left: 0, objectFit: 'cover' }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: WIDTH,
            height: HEIGHT,
            background: 'linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.72) 100%)',
          }}
        />
        {input.cutoutDataUrl ? (
          <img
            src={input.cutoutDataUrl}
            height={HEIGHT}
            style={{ position: 'absolute', right: 24, bottom: 0, objectFit: 'contain' }}
          />
        ) : null}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', padding: 56, gap: 16 }}>
          {input.scripture ? (
            <span style={{ fontSize: 38, color: '#ffd966', fontWeight: 700 }}>{input.scripture}</span>
          ) : null}
          <span style={{ fontSize: 76, color: '#ffffff', fontWeight: 700, lineHeight: 1.1 }}>
            {input.headline}
          </span>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [{ name: 'Pretendard', data: bold, weight: 700, style: 'normal' }],
    }
  )
  return Buffer.from(await response.arrayBuffer())
}

export function toDataUrl(buffer: Buffer, mime = 'image/png'): string {
  return `data:${mime};base64,${buffer.toString('base64')}`
}
