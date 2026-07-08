// Vercel geo 헤더(MaxMind, 국어의 로마자 표기법)를 한글 지역명으로 변환한다.
// 시군구명은 로마자 표기가 표준화되어 있어 정적 테이블로 충분하다.

// ISO 3166-2:KR 시/도 코드 → 한글 축약명 (x-vercel-ip-country-region)
const SIDO_KO: Record<string, string> = {
  '11': '서울',
  '26': '부산',
  '27': '대구',
  '28': '인천',
  '29': '광주',
  '30': '대전',
  '31': '울산',
  '50': '세종',
  '41': '경기',
  '42': '강원',
  '43': '충북',
  '44': '충남',
  '45': '전북',
  '46': '전남',
  '47': '경북',
  '48': '경남',
  '49': '제주',
}

// 로마자 시군구명 → 한글. 동명 구(중구·서구 등)는 시/도 코드로 구분해 표시한다.
// 시 단위는 '-si' 없이 수록하고 조회 시 접미사를 제거해 매칭한다.
const CITY_KO: Record<string, string> = {
  // 광역시/특별시/특별자치시
  Seoul: '서울',
  Busan: '부산',
  Daegu: '대구',
  Incheon: '인천',
  Gwangju: '광주',
  Daejeon: '대전',
  Ulsan: '울산',
  Sejong: '세종',
  // 여러 광역시에 공통인 자치구
  'Jung-gu': '중구',
  'Seo-gu': '서구',
  'Dong-gu': '동구',
  'Nam-gu': '남구',
  'Buk-gu': '북구',
  'Gangseo-gu': '강서구',
  // 서울
  'Jongno-gu': '종로구',
  'Yongsan-gu': '용산구',
  'Seongdong-gu': '성동구',
  'Gwangjin-gu': '광진구',
  'Dongdaemun-gu': '동대문구',
  'Jungnang-gu': '중랑구',
  'Seongbuk-gu': '성북구',
  'Gangbuk-gu': '강북구',
  'Dobong-gu': '도봉구',
  'Nowon-gu': '노원구',
  'Eunpyeong-gu': '은평구',
  'Seodaemun-gu': '서대문구',
  'Mapo-gu': '마포구',
  'Yangcheon-gu': '양천구',
  'Guro-gu': '구로구',
  'Geumcheon-gu': '금천구',
  'Yeongdeungpo-gu': '영등포구',
  'Dongjak-gu': '동작구',
  'Gwanak-gu': '관악구',
  'Seocho-gu': '서초구',
  'Gangnam-gu': '강남구',
  'Songpa-gu': '송파구',
  'Gangdong-gu': '강동구',
  // 부산
  'Yeongdo-gu': '영도구',
  'Busanjin-gu': '부산진구',
  'Dongnae-gu': '동래구',
  'Haeundae-gu': '해운대구',
  'Saha-gu': '사하구',
  'Geumjeong-gu': '금정구',
  'Yeonje-gu': '연제구',
  'Suyeong-gu': '수영구',
  'Sasang-gu': '사상구',
  'Gijang-gun': '기장군',
  // 대구
  'Suseong-gu': '수성구',
  'Dalseo-gu': '달서구',
  'Dalseong-gun': '달성군',
  'Gunwi-gun': '군위군',
  // 인천
  'Michuhol-gu': '미추홀구',
  'Yeonsu-gu': '연수구',
  'Namdong-gu': '남동구',
  'Bupyeong-gu': '부평구',
  'Gyeyang-gu': '계양구',
  'Ganghwa-gun': '강화군',
  'Ongjin-gun': '옹진군',
  // 광주
  'Gwangsan-gu': '광산구',
  // 대전
  'Yuseong-gu': '유성구',
  'Daedeok-gu': '대덕구',
  // 울산
  'Ulju-gun': '울주군',
  // 경기
  Suwon: '수원시',
  'Jangan-gu': '장안구',
  'Gwonseon-gu': '권선구',
  'Paldal-gu': '팔달구',
  'Yeongtong-gu': '영통구',
  Seongnam: '성남시',
  'Sujeong-gu': '수정구',
  'Jungwon-gu': '중원구',
  'Bundang-gu': '분당구',
  Uijeongbu: '의정부시',
  Anyang: '안양시',
  'Manan-gu': '만안구',
  'Dongan-gu': '동안구',
  Bucheon: '부천시',
  Gwangmyeong: '광명시',
  Pyeongtaek: '평택시',
  Dongducheon: '동두천시',
  Ansan: '안산시',
  'Sangnok-gu': '상록구',
  'Danwon-gu': '단원구',
  Goyang: '고양시',
  'Deogyang-gu': '덕양구',
  'Ilsandong-gu': '일산동구',
  'Ilsanseo-gu': '일산서구',
  Gwacheon: '과천시',
  Guri: '구리시',
  Namyangju: '남양주시',
  Osan: '오산시',
  Siheung: '시흥시',
  Gunpo: '군포시',
  Uiwang: '의왕시',
  Hanam: '하남시',
  Yongin: '용인시',
  'Cheoin-gu': '처인구',
  'Giheung-gu': '기흥구',
  'Suji-gu': '수지구',
  Paju: '파주시',
  Icheon: '이천시',
  Anseong: '안성시',
  Gimpo: '김포시',
  Hwaseong: '화성시',
  Yangju: '양주시',
  Pocheon: '포천시',
  Yeoju: '여주시',
  'Yeoncheon-gun': '연천군',
  'Gapyeong-gun': '가평군',
  'Yangpyeong-gun': '양평군',
  // 강원
  Chuncheon: '춘천시',
  Wonju: '원주시',
  Gangneung: '강릉시',
  Donghae: '동해시',
  Taebaek: '태백시',
  Sokcho: '속초시',
  Samcheok: '삼척시',
  'Hongcheon-gun': '홍천군',
  'Hoengseong-gun': '횡성군',
  'Yeongwol-gun': '영월군',
  'Pyeongchang-gun': '평창군',
  'Jeongseon-gun': '정선군',
  'Cheorwon-gun': '철원군',
  'Hwacheon-gun': '화천군',
  'Yanggu-gun': '양구군',
  'Inje-gun': '인제군',
  'Goseong-gun': '고성군',
  'Yangyang-gun': '양양군',
  // 충북
  Cheongju: '청주시',
  'Sangdang-gu': '상당구',
  'Seowon-gu': '서원구',
  'Heungdeok-gu': '흥덕구',
  'Cheongwon-gu': '청원구',
  Chungju: '충주시',
  Jecheon: '제천시',
  'Boeun-gun': '보은군',
  'Okcheon-gun': '옥천군',
  'Yeongdong-gun': '영동군',
  'Jeungpyeong-gun': '증평군',
  'Jincheon-gun': '진천군',
  'Goesan-gun': '괴산군',
  'Eumseong-gun': '음성군',
  'Danyang-gun': '단양군',
  // 충남
  Cheonan: '천안시',
  'Dongnam-gu': '동남구',
  'Seobuk-gu': '서북구',
  Gongju: '공주시',
  Boryeong: '보령시',
  Asan: '아산시',
  Seosan: '서산시',
  Nonsan: '논산시',
  Gyeryong: '계룡시',
  Dangjin: '당진시',
  'Geumsan-gun': '금산군',
  'Buyeo-gun': '부여군',
  'Seocheon-gun': '서천군',
  'Cheongyang-gun': '청양군',
  'Hongseong-gun': '홍성군',
  'Yesan-gun': '예산군',
  'Taean-gun': '태안군',
  // 전북
  Jeonju: '전주시',
  'Wansan-gu': '완산구',
  'Deokjin-gu': '덕진구',
  Gunsan: '군산시',
  Iksan: '익산시',
  Jeongeup: '정읍시',
  Namwon: '남원시',
  Gimje: '김제시',
  'Wanju-gun': '완주군',
  'Jinan-gun': '진안군',
  'Muju-gun': '무주군',
  'Jangsu-gun': '장수군',
  'Imsil-gun': '임실군',
  'Sunchang-gun': '순창군',
  'Gochang-gun': '고창군',
  'Buan-gun': '부안군',
  // 전남
  Mokpo: '목포시',
  Yeosu: '여수시',
  Suncheon: '순천시',
  Naju: '나주시',
  Gwangyang: '광양시',
  'Damyang-gun': '담양군',
  'Gokseong-gun': '곡성군',
  'Gurye-gun': '구례군',
  'Goheung-gun': '고흥군',
  'Boseong-gun': '보성군',
  'Hwasun-gun': '화순군',
  'Jangheung-gun': '장흥군',
  'Gangjin-gun': '강진군',
  'Haenam-gun': '해남군',
  'Yeongam-gun': '영암군',
  'Muan-gun': '무안군',
  'Hampyeong-gun': '함평군',
  'Yeonggwang-gun': '영광군',
  'Jangseong-gun': '장성군',
  'Wando-gun': '완도군',
  'Jindo-gun': '진도군',
  'Sinan-gun': '신안군',
  // 경북
  Pohang: '포항시',
  Gyeongju: '경주시',
  Gimcheon: '김천시',
  Andong: '안동시',
  Gumi: '구미시',
  Yeongju: '영주시',
  Yeongcheon: '영천시',
  Sangju: '상주시',
  Mungyeong: '문경시',
  Gyeongsan: '경산시',
  'Uiseong-gun': '의성군',
  'Cheongsong-gun': '청송군',
  'Yeongyang-gun': '영양군',
  'Yeongdeok-gun': '영덕군',
  'Cheongdo-gun': '청도군',
  'Goryeong-gun': '고령군',
  'Seongju-gun': '성주군',
  'Chilgok-gun': '칠곡군',
  'Yecheon-gun': '예천군',
  'Bonghwa-gun': '봉화군',
  'Uljin-gun': '울진군',
  'Ulleung-gun': '울릉군',
  // 경남
  Changwon: '창원시',
  'Uichang-gu': '의창구',
  'Seongsan-gu': '성산구',
  'Masanhappo-gu': '마산합포구',
  'Masanhoewon-gu': '마산회원구',
  'Jinhae-gu': '진해구',
  Jinju: '진주시',
  Tongyeong: '통영시',
  Sacheon: '사천시',
  Gimhae: '김해시',
  Miryang: '밀양시',
  Geoje: '거제시',
  Yangsan: '양산시',
  'Uiryeong-gun': '의령군',
  'Haman-gun': '함안군',
  'Changnyeong-gun': '창녕군',
  'Namhae-gun': '남해군',
  'Hadong-gun': '하동군',
  'Sancheong-gun': '산청군',
  'Hamyang-gun': '함양군',
  'Geochang-gun': '거창군',
  'Hapcheon-gun': '합천군',
  // 제주
  Jeju: '제주시',
  Seogwipo: '서귀포시',
}

const countryDisplay = new Intl.DisplayNames(['ko'], { type: 'region' })

function lookupCity(city: string | null | undefined): string | null {
  if (!city) return null
  const exact = CITY_KO[city]
  if (exact) return exact
  if (city.endsWith('-si')) return CITY_KO[city.slice(0, -3)] ?? null
  return null
}

function countryNameKo(code: string): string {
  try {
    return countryDisplay.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

export interface RegionParts {
  city: string | null
  country: string | null
  countryRegion: string | null
}

export function formatRegionKo({ city, country, countryRegion }: RegionParts): string | null {
  const cityKo = lookupCity(city)

  if (country === 'KR') {
    const code = countryRegion?.replace(/^KR-/, '')
    const sido = code ? (SIDO_KO[code] ?? null) : null
    if (sido && cityKo) return sido === cityKo ? sido : `${sido} ${cityKo}`
    if (sido) return city ? `${sido} ${city}` : sido
    return cityKo ?? city ?? '대한민국'
  }

  if (country) {
    const name = countryNameKo(country)
    return city ? `${name} ${city}` : name
  }

  // country 미수집 레거시 행: 시군구 테이블 매칭만 시도
  return cityKo ?? city ?? null
}
