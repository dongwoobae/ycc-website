const STATIC_EXTENSION_PATTERN =
  /\.(?:avif|css|gif|ico|jpg|jpeg|js|json|map|mp3|mp4|pdf|png|svg|txt|webmanifest|webp|woff|woff2|xml)$/i

export function isTrackablePath(path: string | null | undefined): boolean {
  if (!path) return false

  let pathname = path
  try {
    pathname = path.startsWith('http') ? new URL(path).pathname : new URL(path, 'https://local.test').pathname
  } catch {
    return false
  }

  if (!pathname.startsWith('/')) return false
  if (pathname === '/sign-in' || pathname.startsWith('/sign-in/')) return false
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return false
  if (pathname === '/api' || pathname.startsWith('/api/')) return false
  if (pathname === '/_next' || pathname.startsWith('/_next/')) return false
  if (pathname === '/favicon.ico' || pathname === '/robots.txt' || pathname === '/sitemap.xml') return false
  if (STATIC_EXTENSION_PATTERN.test(pathname)) return false

  return true
}
