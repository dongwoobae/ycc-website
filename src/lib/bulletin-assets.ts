import { keyFromUrl } from '@/lib/r2'
import type { BulletinPage } from '@/lib/types'

// 이 두 개는 `@/lib/actions/bulletins`(`'use server'`)에 둘 수 없다 —
// server action 모듈은 async 함수만 export 할 수 있어서, 상수나 동기 함수를 하나라도
// 내보내면 번들러가 모듈 전체를 "export 없음"으로 처리하고 빌드가 깨진다.

/** PDF 면 수 상한. 주보는 보통 4~6면이며, 12면을 넘으면 잘못된 파일이다. */
export const maxBulletinPages = 12

/** 면·PDF URL에서 우리 R2의 bulletins/ 키만 뽑는다. 교체 시 정리 대상 목록이 된다. */
export function bulletinAssetKeys(pages: BulletinPage[], pdfUrl: string | undefined): string[] {
  const urls = [
    ...pages.flatMap((page) => [page.fullUrl, page.previewUrl, page.thumbUrl]),
    ...(pdfUrl ? [pdfUrl] : []),
  ]
  return urls.map(keyFromUrl).filter((key) => key.startsWith('bulletins/'))
}
