import { revalidatePath } from 'next/cache'

/**
 * 게시글 변경이 반영되는 경로들을 재검증한다.
 * actions/posts(생성·수정·삭제)와 예약 공개 잡(/api/jobs/publish-post)이 공유한다.
 */
export function revalidatePostPaths(id?: string) {
  revalidatePath('/')
  revalidatePath('/news')
  revalidatePath('/admin/posts')
  if (id) revalidatePath(`/news/${id}`)
}
