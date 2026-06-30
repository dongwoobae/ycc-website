import sharp from 'sharp'

/**
 * PNG/임의 이미지 버퍼를 webp로 변환한다. 썸네일은 1280×720 PNG(수 MB)라
 * Vercel Hobby(이미지 최적화 unoptimized) 환경에서 원본이 그대로 서빙되어 느리므로,
 * 저장 시점에 webp로 변환해 용량을 10~20배 줄인다.
 */
export async function toWebp(input: Buffer, quality = 82): Promise<Buffer> {
  return sharp(input).webp({ quality }).toBuffer()
}
