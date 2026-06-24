/** RapidAPI(yt-api) 공통 설정. 채널 영상 목록·자막이 같은 키/호스트를 공유한다. */
export function rapidApiConfig(): { key: string; host: string } {
  const key = process.env.RAPIDAPI_KEY
  const host = process.env.RAPIDAPI_HOST ?? process.env.RAPIDAPI_TRANSCRIPT_HOST
  if (!key || !host) throw new Error('RAPIDAPI_KEY / RAPIDAPI_HOST not set')
  return { key, host }
}

/** RapidAPI 호출용 인증 헤더. */
export function rapidApiHeaders(): Record<string, string> {
  const { key, host } = rapidApiConfig()
  return { 'x-rapidapi-key': key, 'x-rapidapi-host': host }
}
