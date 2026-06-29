import 'server-only'
import { cropAboveCaption } from './detect-caption-band'

const REMOVE_BG_URL = 'https://api.remove.bg/v1.0/removebg'

/**
 * 이미지 URL(여기서는 유튜브 썸네일)에서 배경을 제거해 투명 PNG Buffer를 반환한다.
 * remove.bg REST API 사용. 구현체 교체 가능하도록 인터페이스를 단순 유지한다.
 */
export async function removeBackground(imageUrl: string): Promise<Buffer> {
  const apiKey = process.env.REMOVE_BG_API_KEY
  if (!apiKey) throw new Error('REMOVE_BG_API_KEY is not set')

  // remove.bg는 원본에 박힌 자막을 전경으로 보존하므로, 원본을 직접 받아 하단 자막 밴드를
  // 잘라낸 뒤 image_file 로 업로드한다(자막이 누끼에 따라오지 않게 한다).
  const srcRes = await fetch(imageUrl)
  if (!srcRes.ok) throw new Error(`source image fetch failed: ${srcRes.status}`)
  const { buffer: prepared } = await cropAboveCaption(Buffer.from(await srcRes.arrayBuffer()))

  const form = new FormData()
  form.append('image_file', new Blob([new Uint8Array(prepared)]), 'source')
  // 원본 유튜브 썸네일이 480x360(0.17MP)이라 preview(≤0.25MP)로도 화질 손실이 없고,
  // 유료 크레딧 대신 remove.bg 무료 등급(월 50건 preview)으로 처리돼 비용이 들지 않는다.
  form.append('size', 'preview')
  form.append('format', 'png')

  const res = await fetch(REMOVE_BG_URL, {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey },
    body: form,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`remove.bg request failed: ${res.status} ${detail}`)
  }
  return Buffer.from(await res.arrayBuffer())
}
