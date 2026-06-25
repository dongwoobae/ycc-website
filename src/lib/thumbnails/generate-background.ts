import 'server-only'
import type { ThumbnailStyle } from './types'

const BACKGROUND_PROMPT: Record<ThumbnailStyle, string> = {
  classic:
    'A serene, reverent church worship background. Soft warm light, subtle cross or stained-glass bokeh, muted gradient. Cinematic, uncluttered, leaves empty space for text. Absolutely no text, no letters, no words.',
  hook:
    'A modern, vibrant Christian YouTube thumbnail background. Dramatic light rays, bold but tasteful gradient, depth of field. Energetic yet reverent. Leaves empty space for text. Absolutely no text, no letters, no words.',
  cutout:
    'A clean studio-style gradient backdrop for a portrait, warm spotlight, soft vignette, church mood. Plain on one side for a person cutout and text. Absolutely no text, no letters, no words.',
}

export async function generateBackground(style: ThumbnailStyle, keywords?: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')

  const theme = keywords?.trim() ? ` Visual theme of this sermon: ${keywords.trim()}.` : ''
  const prompt = BACKGROUND_PROMPT[style] + theme

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-image-2',
      prompt,
      size: '1280x720',
      n: 1,
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`gpt-image-2 request failed: ${res.status} ${detail}`)
  }

  const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] }
  const first = json.data?.[0]
  if (first?.b64_json) return Buffer.from(first.b64_json, 'base64')
  if (first?.url) {
    const img = await fetch(first.url)
    if (!img.ok) throw new Error(`gpt-image-2 image download failed: ${img.status}`)
    return Buffer.from(await img.arrayBuffer())
  }
  throw new Error('gpt-image-2 returned no image data')
}
