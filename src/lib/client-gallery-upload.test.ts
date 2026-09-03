import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadGalleryImages } from './client-gallery-upload'

vi.mock('@/lib/client-image-compress', () => ({
  compressImageFile: vi.fn(async (file: File) => new File([file], `c-${file.name}`, { type: file.type })),
}))

function image(name: string) {
  return new File(['x'], name, { type: 'image/jpeg' })
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('uploadGalleryImages', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('압축한 파일을 업로드하고 원래 순서대로 저장한다', async () => {
    fetchMock.mockImplementation(async (_url, init) => {
      const file = (init?.body as FormData).get('image') as File
      return jsonResponse({ url: `https://r2/gallery/${file.name}` })
    })
    const saveImage = vi.fn<(url: string) => Promise<void>>(async () => {})
    const progress: string[] = []

    const failures = await uploadGalleryImages([image('a.jpg'), image('b.jpg')], saveImage, (t) => progress.push(t))

    expect(failures).toEqual([])
    expect(saveImage.mock.calls.map(([url]) => url)).toEqual([
      'https://r2/gallery/c-a.jpg',
      'https://r2/gallery/c-b.jpg',
    ])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/admin/gallery/upload', '/api/admin/gallery/upload'])
    expect(progress[0]).toBe('압축 중 (1/2)')
    expect(progress.at(-1)).toBe('저장 중...')
  })

  it('업로드가 실패한 파일은 저장하지 않고 실패 목록에 담는다', async () => {
    fetchMock.mockImplementation(async (_url, init) => {
      const file = (init?.body as FormData).get('image') as File
      if (file.name === 'c-bad.jpg') return jsonResponse({ error: '지원하지 않는 이미지 형식입니다.' }, 400)
      return jsonResponse({ url: `https://r2/gallery/${file.name}` })
    })
    const saveImage = vi.fn(async () => {})

    const failures = await uploadGalleryImages([image('bad.jpg'), image('ok.jpg')], saveImage)

    expect(failures).toEqual([{ name: 'c-bad.jpg', error: '지원하지 않는 이미지 형식입니다.' }])
    expect(saveImage).toHaveBeenCalledTimes(1)
    expect(saveImage).toHaveBeenCalledWith('https://r2/gallery/c-ok.jpg')
  })

  it('네트워크 예외와 저장 실패도 실패 목록에 담는다', async () => {
    fetchMock.mockImplementation(async (_url, init) => {
      const file = (init?.body as FormData).get('image') as File
      if (file.name === 'c-net.jpg') throw new TypeError('Failed to fetch')
      return jsonResponse({ url: `https://r2/gallery/${file.name}` })
    })
    const saveImage = vi.fn(async (url: string) => {
      if (url.endsWith('c-db.jpg')) throw new Error('boom')
    })

    const failures = await uploadGalleryImages([image('net.jpg'), image('db.jpg'), image('ok.jpg')], saveImage)

    expect(failures).toEqual([
      { name: 'c-net.jpg', error: '네트워크 오류' },
      { name: 'c-db.jpg', error: '저장 실패' },
    ])
    expect(saveImage).toHaveBeenCalledTimes(2)
  })

  it('파일이 없으면 아무것도 하지 않는다', async () => {
    const saveImage = vi.fn(async () => {})
    const failures = await uploadGalleryImages([], saveImage)
    expect(failures).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(saveImage).not.toHaveBeenCalled()
  })
})
