const BOT_PATTERN =
  /bot|crawler|spider|crawling|slurp|bingpreview|google-inspectiontool|facebookexternalhit|linkedinbot|preview|httpclient|headless/i

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent?.trim()) return false
  return BOT_PATTERN.test(userAgent)
}
