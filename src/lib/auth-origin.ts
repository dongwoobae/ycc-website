export function normalizeOrigin(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return ''

  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return withScheme
    .replace(/^([a-z][a-z\d+.-]*:\/\/)(?:[a-z][a-z\d+.-]*:\/\/)+/i, '$1')
    .replace(/\/+$/, '')
}
