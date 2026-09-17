/** 감사 로그 필터 드롭다운 겸 쿼리 파라미터 화이트리스트. */
export const ACTION_OPTIONS = ['create', 'update', 'delete', 'error', 'warning', 'login', 'logout'] as const

/** 미등록 액션은 회색으로 떨어지므로, ACTION_OPTIONS에 넣은 값은 여기에도 넣는다. */
export const ACTION_BADGE: Record<string, string> = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-orange-100 text-orange-800',
  error: 'bg-red-100 text-red-800',
  warning: 'bg-amber-100 text-amber-800',
  login: 'bg-slate-100 text-slate-700',
  logout: 'bg-slate-100 text-slate-700',
}
