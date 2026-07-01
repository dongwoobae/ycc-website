import { createHash } from 'crypto'

const SESSION_BUCKET_MS = 30 * 60 * 1000

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function expandIpv6(input: string): string[] | null {
  if (!input.includes(':')) return null
  if (input.includes(':::')) return null

  const [leftRaw, rightRaw] = input.toLowerCase().split('::')
  if (input.split('::').length > 2) return null

  const left = leftRaw ? leftRaw.split(':') : []
  const right = rightRaw ? rightRaw.split(':') : []
  const groups = input.includes('::')
    ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right]
    : left

  if (groups.length !== 8) return null
  if (groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null
  return groups.map((group) => Number.parseInt(group, 16).toString(16))
}

export function maskIp(ip: string | null | undefined): string | null {
  const value = ip?.trim()
  if (!value) return null

  const ipv4 = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number)
    if (octets.some((octet) => octet < 0 || octet > 255)) return null
    return `${octets[0]}.${octets[1]}.${octets[2]}.0`
  }

  const groups = expandIpv6(value)
  if (!groups) return null
  return [...groups.slice(0, 4), '0', '0', '0', '0'].join(':')
}

export function hashVisitor(salt: string | null | undefined, date: string, ip: string, userAgent: string): string {
  if (!salt?.trim()) throw new Error('ANALYTICS_SALT is required for visitor analytics')
  return sha256(`${salt}:${date}:${ip}:${userAgent}`)
}

export function sessionId(visitorId: string, date: string, epochMs: number): string {
  const bucket = Math.floor(epochMs / SESSION_BUCKET_MS)
  return sha256(`${visitorId}:${date}:${bucket}`)
}
