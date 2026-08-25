/**
 * sermon_summaries.summary_status 표시용 메타.
 *
 * - none: 아직 요약 파이프라인이 돌지 않음
 * - pending: 클레임되어 진행 중
 * - ready: 요약 완료
 * - failed: 자막은 있으나 요약(Gemini)/잡 발행이 실패 — 스위퍼 재시도 대상
 * - no_transcript: 유튜브 자막·오디오 변환 모두 실패 — 자동 스위퍼는 재시도하지 않는 종결 상태(관리자 수동 재생성으로만 오디오 재시도 가능)
 */
export const SUMMARY_STATUS_META: Record<string, { color: string; label: string }> = {
  ready: { color: '#16a34a', label: '완료' },
  pending: { color: '#92633a', label: '대기' },
  none: { color: '#9ca3af', label: '없음' },
  failed: { color: '#dc2626', label: '실패' },
  no_transcript: { color: '#475569', label: '자막없음' },
}

export function summaryStatusLabel(status: string): string {
  return SUMMARY_STATUS_META[status]?.label ?? status
}
