import { describe, expect, it } from 'vitest'
import { makeTestDb, insertSermonFixture } from './pg'

describe('test db harness', () => {
  it('boots pglite, applies migrations, inserts a sermon', async () => {
    const { db, close } = await makeTestDb()
    const id = await insertSermonFixture(db)
    expect(id).toMatch(/[0-9a-f-]{36}/)
    await close()
  })
})
