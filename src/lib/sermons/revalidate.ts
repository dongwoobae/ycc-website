import { revalidatePath } from 'next/cache'

/**
 * 설교 변경이 노출되는 공개/관리 페이지의 ISR 캐시를 무효화한다.
 * 관리자 액션뿐 아니라 자동 파이프라인(ingest/summarize/reconcile)에서도 호출해야
 * 자동 등록분이 1시간 ISR 주기를 기다리지 않고 즉시 공개된다.
 * (Next 런타임 전용 — 로컬 스크립트에서 부르면 안 됨)
 */
export function revalidateSermonPaths(id?: string) {
  revalidatePath('/')
  revalidatePath('/sermons')
  revalidatePath('/admin/sermons')
  if (id) {
    revalidatePath(`/sermons/${id}`)
    revalidatePath(`/admin/sermons/${id}/edit`)
  }
}
