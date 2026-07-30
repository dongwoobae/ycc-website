import { revalidatePath } from 'next/cache'

/**
 * 게시글 변경이 반영되는 경로들을 재검증한다.
 * actions/posts(생성·수정·삭제)와 예약 공개 잡(/api/jobs/publish-post)이 공유한다.
 *
 * 상세는 개별 id 가 아니라 패턴 전체를 무효화한다 — 글 하나가 생기거나 사라지면
 * 다른 글 상세의 이전/다음 내비게이션도 바뀌기 때문. 사이트맵도 posts 를 소비한다.
 */
export function revalidatePostPaths() {
  revalidatePath('/')
  revalidatePath('/news')
  revalidatePath('/news/[id]', 'page')
  revalidatePath('/sitemap.xml')
  revalidatePath('/admin/posts')
}
