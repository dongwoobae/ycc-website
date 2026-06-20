import { describe, expect, it } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { inflateHwpSection } from './parse'

describe('inflateHwpSection', () => {
  it('rejects decompressed output above the configured cap', () => {
    const compressed = deflateRawSync(Buffer.alloc(128, 'a'))

    expect(() => inflateHwpSection(compressed, 64)).toThrow()
  })
})
