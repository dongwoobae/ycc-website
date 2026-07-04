// 갤러리 이미지 병렬 업로드용 API Route.
// 서버 액션은 React가 직렬화해 순차 실행되므로, 여러 장 동시 업로드는
// fetch + Promise.all이 가능한 Route로 처리한다. R2 업로드까지만 담당하고
// DB 저장은 addImageRecord 서버 액션이 순차로 수행한다(sortOrder 경합 방지).

import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { maxImageSize, processAndUploadImage } from '@/lib/gallery-image'

export type GalleryUploadResponse = { url: string } | { error: string }

export async function POST(req: NextRequest): Promise<NextResponse<GalleryUploadResponse>> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: '요청 파싱 실패' }, { status: 400 })
  }

  const file = formData.get('image')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'image is required' }, { status: 400 })
  }
  if (file.size > maxImageSize) {
    return NextResponse.json({ error: 'image must be 8MB or less' }, { status: 400 })
  }

  try {
    const url = await processAndUploadImage(file)
    return NextResponse.json({ url })
  } catch (error) {
    if (error instanceof Error && error.message === 'unsupported image file') {
      return NextResponse.json({ error: '지원하지 않는 이미지 형식입니다.' }, { status: 400 })
    }
    console.error('[api/admin/gallery/upload] 오류:', error)
    return NextResponse.json({ error: '업로드 중 서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
