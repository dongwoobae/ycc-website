import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { parseWebSubNotification, verifyWebSubSignature } from './websub'

const uploadXml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <entry>
    <yt:videoId>abc123XYZ_-</yt:videoId>
    <yt:channelId>UCchannel</yt:channelId>
    <title>주일예배 설교</title>
    <published>2026-06-23T01:00:00+00:00</published>
    <updated>2026-06-23T01:00:00+00:00</updated>
  </entry>
</feed>`

const deletedXml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:at="http://purl.org/atompub/tombstones/1.0">
  <at:deleted-entry ref="yt:video:abc123XYZ_-" />
</feed>`

describe('parseWebSubNotification', () => {
  it('extracts videoId and published from an upload entry', () => {
    const r = parseWebSubNotification(uploadXml)
    expect(r).toEqual({ kind: 'upload', videoId: 'abc123XYZ_-', published: '2026-06-23T01:00:00+00:00' })
  })

  it('detects deleted-entry as non-upload', () => {
    expect(parseWebSubNotification(deletedXml)).toEqual({ kind: 'deleted' })
  })

  it('returns unknown for malformed payload', () => {
    expect(parseWebSubNotification('<feed></feed>')).toEqual({ kind: 'unknown' })
  })
})

describe('verifyWebSubSignature', () => {
  const secret = 's3cr3t'
  const body = '<feed>x</feed>'
  const sig = 'sha1=' + createHmac('sha1', secret).update(body).digest('hex')

  it('accepts a valid signature', () => {
    expect(verifyWebSubSignature(body, sig, secret)).toBe(true)
  })

  it('accepts a Buffer body signature', () => {
    expect(verifyWebSubSignature(Buffer.from(body), sig, secret)).toBe(true)
  })

  it('rejects a tampered body', () => {
    expect(verifyWebSubSignature(body + 'x', sig, secret)).toBe(false)
  })

  it('rejects missing header', () => {
    expect(verifyWebSubSignature(body, null, secret)).toBe(false)
  })
})
