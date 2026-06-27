export const churchInfo = {
  address: '경북 영천시 완산중앙8길 21',
  phone: '054-334-6644',
  phone2: '054-334-6645',
  blog: 'http://blog.naver.com/ycch6645',
  youtube: 'https://www.youtube.com/channel/UCzB3UsqsJhtFUvPEeOtTL6g',
  // 디모데앱 소개 페이지(PC·iOS·Android 공통, 새 탭)
  dimode: 'https://www.dimode.co.kr/Page/Index/35121',
}

/** 대표번호 표기 (예: "054-334-6644~5") — 두 번호의 끝자리만 묶어 노출 */
export const churchPhoneDisplay = `${churchInfo.phone}~${churchInfo.phone2.slice(-1)}`
