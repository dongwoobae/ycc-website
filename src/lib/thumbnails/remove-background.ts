import 'server-only'

const REMOVE_BG_URL = 'https://api.remove.bg/v1.0/removebg'

/**
 * 이미지 URL(여기서는 유튜브 썸네일)에서 배경을 제거해 투명 PNG Buffer를 반환한다.
 * remove.bg REST API 사용. 구현체 교체 가능하도록 인터페이스를 단순 유지한다.
 */
export async function removeBackground(imageUrl: string): Promise<Buffer> {
  const apiKey = process.env.REMOVE_BG_API_KEY
  if (!apiKey) throw new Error('REMOVE_BG_API_KEY is not set')

  const form = new FormData()
  form.append('image_url', imageUrl)
  form.append('size', 'auto')
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
