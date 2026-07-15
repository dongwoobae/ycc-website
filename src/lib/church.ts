const CHURCH_NAME = '영천중앙교회'

export const churchInfo = {
  name: CHURCH_NAME,
  englishName: 'Yeongcheonjoongangchurch',
  denomination: '대한예수교장로회',
  description: `${CHURCH_NAME} 공식 홈페이지입니다.`,
  address: '경북 영천시 완산중앙8길 21',
  phone: '054-334-6644',
  phone2: '054-334-6645',
  blog: 'http://blog.naver.com/ycch6645',
  youtube: 'https://www.youtube.com/channel/UCzB3UsqsJhtFUvPEeOtTL6g',
  // 디모데앱 소개 페이지(PC·iOS·Android 공통, 새 탭)
  dimode: 'https://www.dimode.co.kr/Page/Index/35121',
  seniorPastor: {
    name: '김선찬',
    title: '담임목사',
  },
  offeringAccount: {
    bank: '농협',
    number: '723040-51-047200',
    holder: CHURCH_NAME,
  },
} as const

/** 대표번호 표기 (예: "054-334-6644~5") — 두 번호의 끝자리만 묶어 노출 */
export const churchPhoneDisplay = `${churchInfo.phone}~${churchInfo.phone2.slice(-1)}`

export const churchOfferingAccountDisplay =
  `${churchInfo.offeringAccount.bank} ${churchInfo.offeringAccount.number} ${churchInfo.offeringAccount.holder}`
