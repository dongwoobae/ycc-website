// 브라우저 전용 모듈. 관리자 화면에서만 동적 import 한다.
//
// 서버에서 변환하지 않는 이유: sharp 는 Vercel 에서 PDF 를 읽지 못한다
// (libvips 에 poppler/pdfium 이 없다). 브라우저 변환이면 서버 네이티브 의존성이 0이다.

import { bulletinSizeNames, bulletinSizes, scaleToLongEdge, type BulletinSizeName } from '@/lib/bulletin-scale'

export const maxBulletinPages = 12
export const maxBulletinFileSize = 40 * 1024 * 1024

export type RenderedMime = 'image/webp' | 'image/jpeg'

export interface RenderedPage {
  pageNumber: number
  /** full 기준 치수 */
  width: number
  height: number
  blobs: Record<BulletinSizeName, Blob>
}

export interface RenderResult {
  mime: RenderedMime
  pages: RenderedPage[]
}

/** 업로드 전 형식·크기 검사. 문제가 없으면 null, 있으면 사용자에게 보여줄 메시지. */
export function validateOriginFile(file: { size: number; type: string }): string | null {
  if (file.size > maxBulletinFileSize) return '파일이 너무 큽니다. 40MB 이하로 올려주세요.'
  if (file.type === 'application/pdf') return null
  if (file.type.startsWith('image/')) return null
  return 'PDF 또는 이미지 파일만 올릴 수 있습니다.'
}

function toBlob(canvas: HTMLCanvasElement, mime: RenderedMime): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), mime, 0.82))
}

/**
 * canvas 를 인코딩한다. webp 를 요청했는데 브라우저가 지원하지 않으면(toBlob 이 null)
 * jpeg 로 폴백한다. 폴백하면 이후 모든 면이 같은 mime 을 써야 하므로 결과에 mime 을 실어 보낸다.
 */
export async function encodeCanvas(
  canvas: HTMLCanvasElement,
  preferred: RenderedMime,
): Promise<{ blob: Blob; mime: RenderedMime }> {
  if (preferred === 'image/webp') {
    const webp = await toBlob(canvas, 'image/webp')
    if (webp) return { blob: webp, mime: 'image/webp' }
  }
  const jpeg = await toBlob(canvas, 'image/jpeg')
  if (jpeg) return { blob: jpeg, mime: 'image/jpeg' }
  throw new Error('이미지 변환에 실패했습니다. 다른 브라우저에서 시도해 주세요.')
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('캔버스를 만들 수 없습니다.')
  return { canvas, context }
}

/** 렌더가 끝난 canvas 를 즉시 해제한다. iOS Safari 는 이걸 빼면 몇 면 만에 메모리가 터진다. */
function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}

/** 원본 canvas 에서 세 크기 blob 을 만든다. */
async function encodeThreeSizes(
  source: HTMLCanvasElement,
  sourceWidth: number,
  sourceHeight: number,
  preferred: RenderedMime,
) {
  const blobs = {} as Record<BulletinSizeName, Blob>
  let mime = preferred
  for (const name of bulletinSizeNames) {
    const scaled = scaleToLongEdge(sourceWidth, sourceHeight, bulletinSizes[name])
    const { canvas, context } = makeCanvas(scaled.width, scaled.height)
    try {
      context.drawImage(source, 0, 0, scaled.width, scaled.height)
      const encoded = await encodeCanvas(canvas, mime)
      blobs[name] = encoded.blob
      mime = encoded.mime
    } finally {
      releaseCanvas(canvas)
    }
  }
  return { blobs, mime }
}

/**
 * PDF 를 면별로 렌더해 면당 세 크기 blob 을 만든다.
 * 면을 순차 처리하는 이유: 병렬 렌더는 iOS Safari 의 canvas 메모리를 터뜨린다.
 */
export async function renderPdfToPages(file: File): Promise<RenderResult> {
  const pdfjs = await import('pdfjs-dist')
  // 번들러의 워커 처리에 의존하지 않는다 — prebuild 가 public/ 으로 복사해 둔 파일을 쓴다.
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

  // destroy() 는 로딩 태스크에 있다(PDFDocumentProxy 에는 cleanup() 만 있다).
  // 워커까지 정리하려면 태스크 참조를 들고 있어야 한다.
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() })
  const doc = await loadingTask.promise
  try {
    if (doc.numPages > maxBulletinPages) {
      throw new Error(`면 수가 너무 많습니다. ${maxBulletinPages}면 이하 PDF만 올릴 수 있습니다.`)
    }

    const pages: RenderedPage[] = []
    let mime: RenderedMime = 'image/webp'

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber)
      try {
        const base = page.getViewport({ scale: 1 })
        const target = scaleToLongEdge(base.width, base.height, bulletinSizes.full)
        const viewport = page.getViewport({ scale: target.scale })
        // pdfjs v6 은 canvas 를 넘기는 형태를 권장한다 — canvasContext 는 하위호환용이며
        // 그것을 쓸 때는 canvas 가 null 이어야 해서 둘을 같이 넘기지 않는다.
        const { canvas } = makeCanvas(Math.round(viewport.width), Math.round(viewport.height))
        try {
          await page.render({ canvas, viewport }).promise
          const encoded = await encodeThreeSizes(canvas, canvas.width, canvas.height, mime)
          mime = encoded.mime
          pages.push({ pageNumber, width: canvas.width, height: canvas.height, blobs: encoded.blobs })
        } finally {
          releaseCanvas(canvas)
        }
      } finally {
        page.cleanup()
      }
    }

    return { mime, pages }
  } finally {
    await loadingTask.destroy()
  }
}

/** 이미지 파일 여러 장을 면으로 받는다. PDF 경로와 같은 규칙으로 세 크기를 만든다. */
export async function renderImagesToPages(files: File[]): Promise<RenderResult> {
  if (files.length > maxBulletinPages) {
    throw new Error(`면 수가 너무 많습니다. ${maxBulletinPages}장 이하로 올려주세요.`)
  }

  const pages: RenderedPage[] = []
  let mime: RenderedMime = 'image/webp'

  for (const [index, file] of files.entries()) {
    const url = URL.createObjectURL(file)
    try {
      const image = await loadImage(url)
      const target = scaleToLongEdge(image.naturalWidth, image.naturalHeight, bulletinSizes.full)
      const { canvas, context } = makeCanvas(target.width, target.height)
      try {
        context.drawImage(image, 0, 0, target.width, target.height)
        const encoded = await encodeThreeSizes(canvas, canvas.width, canvas.height, mime)
        mime = encoded.mime
        pages.push({
          pageNumber: index + 1,
          width: canvas.width,
          height: canvas.height,
          blobs: encoded.blobs,
        })
      } finally {
        releaseCanvas(canvas)
      }
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  return { mime, pages }
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'))
    image.src = url
  })
}
