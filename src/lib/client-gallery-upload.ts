import { compressImageFile } from '@/lib/client-image-compress'
import type { GalleryUploadResponse } from '@/app/api/admin/gallery/upload/route'

export interface GalleryUploadFailure {
  name: string
  error: string
}

type UploadResult = { name: string; url: string } | { name: string; url?: never; error: string }

// 압축(순차) → R2 업로드(병렬, API Route) → DB 저장(순차 서버 액션) 3단계.
// 서버 액션은 React가 직렬화하므로 업로드 단계만 fetch로 병렬 처리하고,
// 저장은 sortOrder 경합을 피해 순차 실행한다. 실패는 던지지 않고 목록으로 돌려준다.
export async function uploadGalleryImages(
  files: File[],
  saveImage: (imageUrl: string) => Promise<void>,
  onProgress: (text: string) => void = () => {},
): Promise<GalleryUploadFailure[]> {
  if (files.length === 0) return []

  // 캔버스는 메인 스레드라 순차로 돌리고 진행률만 표시
  const compressed: File[] = []
  for (const [index, file] of files.entries()) {
    onProgress(`압축 중 (${index + 1}/${files.length})`)
    compressed.push(await compressImageFile(file))
  }

  let uploadedCount = 0
  onProgress(`업로드 중 (0/${compressed.length})`)
  const results = await Promise.all(
    compressed.map(async (file): Promise<UploadResult> => {
      try {
        const body = new FormData()
        body.append('image', file)
        const res = await fetch('/api/admin/gallery/upload', { method: 'POST', body })
        const data = (await res.json()) as GalleryUploadResponse
        if (!res.ok || !('url' in data)) {
          return { name: file.name, error: 'error' in data ? data.error : '업로드 실패' }
        }
        return { name: file.name, url: data.url }
      } catch {
        return { name: file.name, error: '네트워크 오류' }
      } finally {
        uploadedCount += 1
        onProgress(`업로드 중 (${uploadedCount}/${compressed.length})`)
      }
    }),
  )

  onProgress('저장 중...')
  const failures = results.filter((result): result is { name: string; error: string } => 'error' in result)
  for (const result of results) {
    if (!result.url) continue
    try {
      await saveImage(result.url)
    } catch {
      failures.push({ name: result.name, error: '저장 실패' })
    }
  }
  return failures
}
