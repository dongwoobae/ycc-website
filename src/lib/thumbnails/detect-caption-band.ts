import 'server-only'
import sharp from 'sharp'

// 유튜브 썸네일 하단에 박힌 자막(로워서드)은 가로로 넓게 퍼진 고주파(edge) 밴드로 나타난다.
// 행별 가로 edge 밀도를 분석해 그 밴드의 상단을 찾고, 그 위로 잘라 remove.bg가 자막을
// 전경으로 보존하지 않게 한다. 자막이 없으면 원본을 그대로 돌려준다.

const LETTERBOX_MEAN = 16 // 이 평균밝기 미만의 가장자리 행은 레터박스(검은 띠)로 보고 트림
const EDGE_RATIO = 0.35 // 자막 판정 임계 = 콘텐츠 내 최대 edge의 35%
const MIN_EDGE = 10 // 가로 텍스처가 이보다 약하면 자막 없음으로 간주(평탄 배경)
const SEARCH_FROM_RATIO = 0.6 // 하단 40% 구간에서만 자막 밴드를 찾는다
const BAND_BOTTOM_MIN_RATIO = 0.85 // 자막은 거의 바닥에 붙어있어야 함(밴드 최하단 위치 하한)
const BAND_TOP_MAX_RATIO = 0.5 // 밴드 상단이 콘텐츠 절반보다 위면 인물 오검출로 보고 crop 생략
const BAND_GAP_RATIO = 0.02 // 밴드 확장 시 줄 사이 작은 공백 허용치(인물로 번지지 않게 작게 유지)
const CROP_MARGIN_RATIO = 0.07 // 검출된 밴드 상단보다 더 위에서 자르는 고정 여유(임계 미달 밝은 윗줄 자막 제거)

export interface CaptionCropResult {
  buffer: Buffer
  cropped: boolean
}

/**
 * 이미지 하단의 자막 밴드를 검출해 그 위로 잘라낸 버퍼를 반환한다.
 * 검출 실패/미검출/오류 시에는 원본 버퍼를 그대로 반환한다(cropped=false).
 */
export async function cropAboveCaption(input: Buffer): Promise<CaptionCropResult> {
  try {
    const { data, info } = await sharp(input).greyscale().raw().toBuffer({ resolveWithObject: true })
    const W = info.width
    const H = info.height

    const rowMean = new Array<number>(H)
    const rowEdge = new Array<number>(H)
    for (let y = 0; y < H; y++) {
      let sum = 0
      let edge = 0
      let prev = data[y * W]
      for (let x = 0; x < W; x++) {
        const v = data[y * W + x]
        sum += v
        edge += Math.abs(v - prev)
        prev = v
      }
      rowMean[y] = sum / W
      rowEdge[y] = edge / W
    }

    // 상/하 레터박스 트림 → 실제 콘텐츠 영역[top, bot]
    let top = 0
    let bot = H - 1
    while (top < H && rowMean[top] < LETTERBOX_MEAN) top++
    while (bot > top && rowMean[bot] < LETTERBOX_MEAN) bot--
    const contentH = bot - top + 1
    if (contentH < 10) return { buffer: input, cropped: false }

    let maxEdge = 0
    for (let y = top; y <= bot; y++) if (rowEdge[y] > maxEdge) maxEdge = rowEdge[y]
    if (maxEdge < MIN_EDGE) return { buffer: input, cropped: false }

    const thr = maxEdge * EDGE_RATIO
    const searchFrom = top + Math.floor(contentH * SEARCH_FROM_RATIO)

    // 하단 구간에서 가장 아래쪽의 활성(자막) 행 찾기
    let y = bot
    while (y >= searchFrom && rowEdge[y] < thr) y--
    if (y < searchFrom) return { buffer: input, cropped: false }

    // 자막은 바닥에 붙어 있어야 한다
    if (y < top + contentH * BAND_BOTTOM_MIN_RATIO) return { buffer: input, cropped: false }

    // 활성 행을 위로 확장(작은 공백은 허용)하여 자막 밴드 상단 검출
    const maxGap = Math.max(2, Math.floor(contentH * BAND_GAP_RATIO))
    let bandTop = y
    let gap = 0
    for (let yy = y - 1; yy >= top; yy--) {
      if (rowEdge[yy] >= thr) {
        bandTop = yy
        gap = 0
      } else if (++gap > maxGap) {
        break
      }
    }

    // 밴드 상단이 너무 높으면(인물 전체가 잡힘) crop 생략
    if (bandTop <= top + contentH * BAND_TOP_MAX_RATIO) return { buffer: input, cropped: false }

    const margin = Math.floor(contentH * CROP_MARGIN_RATIO)
    const cropHeight = bandTop - margin
    if (cropHeight <= 0 || cropHeight >= H) return { buffer: input, cropped: false }

    const buffer = await sharp(input)
      .extract({ left: 0, top: 0, width: W, height: cropHeight })
      .toBuffer()
    return { buffer, cropped: true }
  } catch {
    return { buffer: input, cropped: false }
  }
}
