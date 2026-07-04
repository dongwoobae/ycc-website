// 브라우저 캔버스로 업로드 전 이미지를 축소/재인코딩한다.
// Vercel 함수는 요청 본문이 4.5MB를 넘으면 코드 실행 전에 FUNCTION_PAYLOAD_TOO_LARGE로
// 잘라버리므로, 서버(sharp) 압축에 도달하려면 전송 자체를 그 밑으로 줄여야 한다.
// 서버가 어차피 webp로 재인코딩하므로 작은 파일은 화질 이중 손실을 피해 원본 그대로 보낸다.

const compressThreshold = 3.5 * 1024 * 1024
const maxDimension = 1920

function encodeCanvas(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    // 브라우저가 요청한 type을 지원하지 않으면 png로 폴백되므로 type 일치까지 확인한다.
    canvas.toBlob((blob) => resolve(blob && blob.type === type ? blob : null), type, quality)
  })
}

export async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= compressThreshold) return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = (await encodeCanvas(canvas, 'image/webp', 0.75)) ?? (await encodeCanvas(canvas, 'image/jpeg', 0.8))
    if (!blob || blob.size >= file.size) return file

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image'
    const extension = blob.type === 'image/webp' ? 'webp' : 'jpg'
    return new File([blob], `${baseName}.${extension}`, { type: blob.type })
  } catch {
    // 디코딩 불가(HEIC 등) → 원본 그대로 두고 서버 검증에 맡긴다.
    return file
  }
}

export async function compressFormDataImage(formData: FormData, name: string) {
  const value = formData.get(name)
  if (value instanceof File && value.size > 0) {
    formData.set(name, await compressImageFile(value))
  }
}
