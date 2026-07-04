// 브라우저 → R2 직접 업로드 도우미. fetch는 업로드 진행률 이벤트가 없어 XHR 사용.

export function putWithProgress(url: string, file: File, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    // presign 서명에 Content-Type이 포함되므로 반드시 동일 값으로 보낸다
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`영상 업로드 실패 (HTTP ${xhr.status})`))
    xhr.onerror = () => reject(new Error('영상 업로드 실패 — 네트워크 또는 R2 CORS 설정을 확인하세요.'))
    xhr.send(file)
  })
}

// 첫 프레임(0.1초 지점)을 JPEG로 캡처한다. 브라우저가 코덱을 못 읽으면 null —
// 호출부는 포스터 없이 저장하고 표시 측이 플레이스홀더를 쓴다.
export function extractVideoPoster(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    let settled = false

    const finish = (blob: Blob | null) => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
      resolve(blob)
    }

    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.onerror = () => finish(null)
    video.onloadeddata = () => {
      // 0초 프레임이 빈 화면인 기기가 있어 살짝 시킹한다
      video.currentTime = Math.min(0.1, video.duration || 0.1)
    }
    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      if (!canvas.width || !canvas.height) return finish(null)
      const ctx = canvas.getContext('2d')
      if (!ctx) return finish(null)
      ctx.drawImage(video, 0, 0)
      canvas.toBlob((blob) => finish(blob), 'image/jpeg', 0.85)
    }
    // 메타데이터/시킹 이벤트가 영영 안 오는 경우 대비
    setTimeout(() => finish(null), 10_000)
    video.src = url
  })
}
