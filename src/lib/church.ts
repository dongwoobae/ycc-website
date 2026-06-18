export const churchInfo = {
  address: '경북 영천시 완산중앙8길 21',
  phone: '054-334-6644',
  phone2: '054-334-6645',
  blog: 'http://blog.naver.com/ycch6645',
}

/** 대표번호 표기 (예: "054-334-6644~5") — 두 번호의 끝자리만 묶어 노출 */
export const churchPhoneDisplay = `${churchInfo.phone}~${churchInfo.phone2.slice(-1)}`
