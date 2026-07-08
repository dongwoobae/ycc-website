import { describe, expect, it } from 'vitest'
import { isDatacenterIp } from './datacenter'

describe('isDatacenterIp', () => {
  it('blocks observed Google Cloud crawler ranges', () => {
    expect(isDatacenterIp('34.72.176.12')).toBe(true)
    expect(isDatacenterIp('34.123.170.55')).toBe(true)
  })

  it('blocks observed AWS crawler ranges', () => {
    expect(isDatacenterIp('13.223.49.3')).toBe(true)
    expect(isDatacenterIp('18.233.225.9')).toBe(true)
  })

  it('blocks observed OVH crawler range', () => {
    expect(isDatacenterIp('144.217.135.1')).toBe(true)
  })

  it('blocks known scanner range (IP Volume, Utrecht)', () => {
    expect(isDatacenterIp('89.248.172.7')).toBe(true)
  })

  it('matches masked ips (last octet zeroed) the same way', () => {
    expect(isDatacenterIp('34.72.176.0')).toBe(true)
    expect(isDatacenterIp('144.217.135.0')).toBe(true)
  })

  it('allows korean residential/mobile ranges', () => {
    expect(isDatacenterIp('118.235.84.10')).toBe(false)
    expect(isDatacenterIp('211.229.32.5')).toBe(false)
    expect(isDatacenterIp('14.46.13.200')).toBe(false)
    expect(isDatacenterIp('219.240.45.1')).toBe(false)
  })

  it('allows non-datacenter ips near range boundaries', () => {
    expect(isDatacenterIp('34.63.255.255')).toBe(false)
    expect(isDatacenterIp('13.224.0.0')).toBe(false)
    expect(isDatacenterIp('144.218.0.0')).toBe(false)
  })

  it('returns false for invalid or ipv6 input', () => {
    expect(isDatacenterIp('')).toBe(false)
    expect(isDatacenterIp('not-an-ip')).toBe(false)
    expect(isDatacenterIp('2001:db8::1')).toBe(false)
    expect(isDatacenterIp('34.72.999.1')).toBe(false)
  })
})
