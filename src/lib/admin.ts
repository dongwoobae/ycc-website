// 서버 로그 열람 허용 계정 (단일 SoT — layout nav 게이팅과 page 가드 양쪽에서 사용)
export const LOG_ADMIN_EMAIL = 'dw5817@naver.com'

export function canViewServerLog(email?: string | null): boolean {
  return email === LOG_ADMIN_EMAIL
}
