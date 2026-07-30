'use client'

import { useState } from 'react'
import { prepareBulletinUpload } from '@/lib/actions/bulletins'
import { putWithProgress } from '@/lib/client-video-upload'
import type { BulletinPage } from '@/lib/types'

interface BulletinOriginUploadProps {
  bulletinDate: string
  pageCount: number
  onUploaded: (result: { pages: BulletinPage[]; pdfUrl?: string }) => void
}

/**
 * 원본 PDF(또는 이미지 여러 장)를 면별 세 크기 이미지로 변환해 R2에 직접 올린다.
 *
 * 브라우저에서 변환하는 이유: sharp 는 Vercel 에서 PDF 를 못 읽는다(libvips 에 poppler 없음).
 * 서버 액션 1회로 서명 URL 배열을 받고 병렬 PUT 하므로 갤러리처럼 별도 Route 가 필요 없다.
 */
export default function BulletinOriginUpload({ bulletinDate, pageCount, onUploaded }: BulletinOriginUploadProps) {
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleFiles(files: File[]) {
    if (files.length === 0) return
    setError('')
    setBusy(true)
    try {
      // 무거운 pdfjs 는 실제로 파일을 고른 뒤에만 받는다
      const { renderImagesToPages, renderPdfToPages, validateOriginFile } = await import('@/lib/bulletin-pdf')

      for (const file of files) {
        const problem = validateOriginFile(file)
        if (problem) throw new Error(problem)
      }

      const isPdf = files.length === 1 && files[0].type === 'application/pdf'
      setStatus(isPdf ? 'PDF를 면별 이미지로 변환하는 중...' : '이미지를 변환하는 중...')
      const rendered = isPdf ? await renderPdfToPages(files[0]) : await renderImagesToPages(files)
      if (rendered.pages.length === 0) throw new Error('변환된 면이 없습니다.')

      setStatus('업로드 준비 중...')
      const plan = await prepareBulletinUpload({
        date: bulletinDate,
        pageCount: rendered.pages.length,
        hasPdf: isPdf,
        imageMime: rendered.mime,
      })

      setStatus('업로드 중...')
      let done = 0
      const total = plan.pages.length + (plan.pdf ? 1 : 0)
      const bump = () => {
        done += 1
        setStatus(`업로드 중... ${done}/${total}`)
      }

      await Promise.all(
        plan.pages.map(async (target) => {
          const page = rendered.pages.find((item) => item.pageNumber === target.pageNumber)
          if (!page) throw new Error('변환 결과와 업로드 대상이 어긋났습니다.')
          const blob = page.blobs[target.size]
          await putWithProgress(target.uploadUrl, new File([blob], `${target.size}`, { type: rendered.mime }), () => {})
          bump()
        })
      )

      if (plan.pdf && isPdf) {
        await putPdf(plan.pdf.uploadUrl, files[0], plan.pdf.contentDisposition)
        bump()
      }

      const pages: BulletinPage[] = rendered.pages.map((page) => ({
        width: page.width,
        height: page.height,
        fullUrl: urlFor(plan, page.pageNumber, 'full'),
        previewUrl: urlFor(plan, page.pageNumber, 'preview'),
        thumbUrl: urlFor(plan, page.pageNumber, 'thumb'),
      }))

      onUploaded({ pages, ...(plan.pdf && isPdf ? { pdfUrl: plan.pdf.publicUrl } : {}) })
      setStatus(`${pages.length}면 업로드 완료`)
    } catch (e) {
      // 일부 PUT 이 실패하면 onUploaded 를 부르지 않으므로 DB 는 건드려지지 않는다.
      // 남은 R2 객체는 다음 성공 업로드 때 정리 대상에 들어간다.
      setStatus('')
      setError(e instanceof Error ? e.message : '업로드에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl bg-paper p-6 shadow-sm">
      <h2 className="text-sm font-bold text-ink">원본 주보</h2>
      <p className="mt-1.5 text-xs text-faint">
        PDF 1개 또는 이미지 여러 장. 브라우저가 면별로 큰·중간·작은 이미지를 만들어 올립니다. 최대 12면 / 40MB.
      </p>
      <input
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        multiple
        disabled={busy}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          void handleFiles(files)
        }}
        className="mt-4 block w-full text-sm text-ink"
      />
      {pageCount > 0 ? <p className="mt-3 text-xs font-bold text-ink">현재 등록된 면: {pageCount}면</p> : null}
      {status ? <p className="mt-2 text-xs text-ink-muted">{status}</p> : null}
      {error ? <p className="mt-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink">{error}</p> : null}
    </div>
  )
}

function urlFor(
  plan: Awaited<ReturnType<typeof prepareBulletinUpload>>,
  pageNumber: number,
  size: 'full' | 'preview' | 'thumb'
) {
  const target = plan.pages.find((item) => item.pageNumber === pageNumber && item.size === size)
  if (!target) throw new Error('업로드 대상 URL을 찾을 수 없습니다.')
  return target.publicUrl
}

// presign 에 content-disposition 이 서명돼 있으므로 같은 값을 헤더로 보내야 R2 가 받는다.
function putPdf(url: string, file: File, contentDisposition: string) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', 'application/pdf')
    xhr.setRequestHeader('Content-Disposition', contentDisposition)
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`PDF 업로드 실패 (HTTP ${xhr.status})`))
    xhr.onerror = () => reject(new Error('PDF 업로드 실패 — 네트워크 또는 R2 CORS 설정을 확인하세요.'))
    xhr.send(file)
  })
}
