import sharp from 'sharp'

// 네이티브 바이너리 로드 실패 시 sharp 는 경고 없이 WASM 으로 폴백한다(느리고,
// 출력 버퍼가 SharedArrayBuffer 기반이 됨). 운영 로그에서 폴백 여부를 식별하기 위해 남긴다.
if ('emscripten' in sharp.versions) {
  console.warn('[sharp] 네이티브 바이너리 로드 실패 — WASM(@img/sharp-wasm32) 폴백으로 동작 중')
}

/**
 * PNG/임의 이미지 버퍼를 webp로 변환한다. 썸네일은 1280×720 PNG(수 MB)라
 * Vercel Hobby(이미지 최적화 unoptimized) 환경에서 원본이 그대로 서빙되어 느리므로,
 * 저장 시점에 webp로 변환해 용량을 10~20배 줄인다.
 */
export async function toWebp(input: Buffer, quality = 82): Promise<Buffer> {
  return sharp(input).webp({ quality }).toBuffer()
}
