// 사이트 정적 이미지는 repo(public/)가 아니라 R2 `static/` 프리픽스에서 서빙한다.
// 파일 추가·교체는 public 에 두지 말고 scripts/upload-static-images.ts 로 업로드할 것.
const R2_STATIC_BASE = 'https://pub-bd370bc18b5d4ccf9c5c2a761461d395.r2.dev/static'

export function staticImg(path: `/images/${string}`) {
  return `${R2_STATIC_BASE}${path}`
}
