import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import { positionToLayout } from './position'
import {
  DEFAULT_THUMBNAIL_COLORS,
  DEFAULT_THUMBNAIL_POSITION,
  type ThumbnailColors,
  type ThumbnailPosition,
  type ThumbnailText,
} from './types'

// 밝은 배경에서도 글자가 묻히지 않도록 반투명 검은 그림자를 깐다.
const TEXT_SHADOW = '0px 2px 8px rgba(0,0,0,0.55)'

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
  position?: ThumbnailPosition
  colors?: ThumbnailColors
}

export async function renderThumbnail(input: RenderInput): Promise<Buffer> {
  const { bold } = await loadFonts()
  const layout = positionToLayout(input.position ?? DEFAULT_THUMBNAIL_POSITION)
  const colors = input.colors ?? DEFAULT_THUMBNAIL_COLORS
  const response = new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: layout.justifyContent,
          alignItems: layout.alignItems,
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
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: layout.alignItems,
            textAlign: layout.textAlign,
            padding: 56,
            gap: 16,
          }}
        >
          {input.scripture ? (
            <span style={{ fontSize: 38, color: colors.scripture, fontWeight: 700, textShadow: TEXT_SHADOW }}>
              {input.scripture}
            </span>
          ) : null}
          <span
            style={{ fontSize: 76, color: colors.headline, fontWeight: 700, lineHeight: 1.1, textShadow: TEXT_SHADOW }}
          >
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
