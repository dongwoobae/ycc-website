import type { BulletinFormInput } from '@/lib/actions/bulletins'
import type { BulletinNotice, BulletinPage } from '@/lib/types'

/**
 * 공지 항목을 정규화한다.
 * when을 빈 문자열이 아니라 키 부재로 만드는 이유: 화면에서 시간 배지 유무를
 * `notice.when`의 truthy 판정 하나로 결정하도록 상태를 하나만 남긴다.
 */
export function normalizeNotices(value: BulletinNotice[]): BulletinNotice[] {
  return value
    .map((notice) => ({
      title: notice.title.trim(),
      detail: notice.detail.trim(),
      when: notice.when?.trim() ?? '',
    }))
    .filter((notice) => notice.title || notice.detail)
    .map(({ title, detail, when }) => ({ title, detail, ...(when ? { when } : {}) }))
}

/**
 * 면 이미지를 검증한다. 세 크기 URL과 유효한 치수가 모두 있어야 통과한다.
 * 업로드가 부분 실패한 면이 DB로 들어가면 라이트박스가 깨진 이미지를 띄운다.
 */
export function normalizePages(value: BulletinPage[]): BulletinPage[] {
  return value.filter(
    (page) =>
      page.fullUrl.trim() !== '' &&
      page.previewUrl.trim() !== '' &&
      page.thumbUrl.trim() !== '' &&
      Number.isFinite(page.width) &&
      Number.isFinite(page.height) &&
      page.width > 0 &&
      page.height > 0,
  )
}

export function normalizeBulletinInput(input: BulletinFormInput): BulletinFormInput {
  return {
    bulletinDate: input.bulletinDate,
    volume: input.volume.trim(),
    issue: input.issue.trim(),
    sermonTitle: input.sermonTitle.trim(),
    scripture: input.scripture.trim(),
    preacher: input.preacher.trim(),
    hymns: input.hymns.trim(),
    responsiveReading: input.responsiveReading.trim(),
    nextWeek: input.nextWeek.trim(),
    pdfUrl: input.pdfUrl?.trim() || undefined,
    notices: normalizeNotices(input.notices),
    pages: normalizePages(input.pages),
  }
}
