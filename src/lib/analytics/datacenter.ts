// 접속분석에서 관측된 데이터센터/스캐너 대역. 실사용자는 이 대역에서 접속하지 않는다.
const DATACENTER_CIDRS = [
  '34.64.0.0/10', // Google Cloud (Council Bluffs 등)
  '34.128.0.0/10', // Google Cloud
  '13.216.0.0/13', // AWS us-east-1 (Ashburn)
  '18.128.0.0/9', // AWS us-east-1 (Ashburn)
  '144.217.0.0/16', // OVH (Beauharnois)
  '89.248.160.0/20', // IP Volume 스캐너 (Utrecht)
] as const

function ipv4ToInt(ip: string): number | null {
  const match = ip.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!match) return null
  const octets = match.slice(1).map(Number)
  if (octets.some((octet) => octet > 255)) return null
  return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0
}

const RANGES = DATACENTER_CIDRS.map((cidr) => {
  const [base, prefix] = cidr.split('/')
  const mask = prefix === '0' ? 0 : (0xffffffff << (32 - Number(prefix))) >>> 0
  return { network: (ipv4ToInt(base)! & mask) >>> 0, mask }
})

export function isDatacenterIp(ip: string | null | undefined): boolean {
  if (!ip) return false
  const value = ipv4ToInt(ip)
  if (value === null) return false
  return RANGES.some(({ network, mask }) => ((value & mask) >>> 0) === network)
}
