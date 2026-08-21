// Pretendard 동적 서브셋(unicode-range 분할)을 빌드 산출물 자리로 꺼낸다.
//
// 풀셋·정적 서브셋은 굵기 하나가 각각 750KB·262KB라 첫 화면 전송량을 지배했다.
// 동적 서브셋은 조각이 평균 12KB고 브라우저가 페이지에 실제로 쓰인 범위만 받는다.
//
// next/font/local 로는 표현할 수 없다 — src 항목마다 unicode-range 를 줄 수 없어서
// 92개 범위를 선언할 방법이 없다. 그래서 @font-face CSS 를 직접 만든다.
// 조각은 public/ 에, CSS 는 src/app/ 에 둔다 — layout 이 import 해야 Next 의 CSS
// 파이프라인(해시·압축·번들)을 타고, 수동 <link> 를 금지하는 규칙과도 어긋나지 않는다.
//
// predev/prebuild 에서 돌기 때문에 pretendard 를 올릴 때 따로 챙길 일이 없다.

import { copyFile, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

// layout.tsx 가 쓰는 굵기. 여기서 뺀 굵기는 조각도 CSS 도 나가지 않는다.
const WEIGHTS = new Set(['400', '500', '600', '700', '800'])
const PUBLIC_PATH = '/fonts/pretendard'

const require = createRequire(import.meta.url)
const staticDir = path.join(path.dirname(require.resolve('pretendard/package.json')), 'dist/web/static')
const outDir = path.join(process.cwd(), 'public', 'fonts', 'pretendard')
const cssPath = path.join(process.cwd(), 'src', 'app', 'pretendard-subset.css')

const css = await readFile(path.join(staticDir, 'pretendard-dynamic-subset.css'), 'utf8')

const blocks = css.match(/@font-face\s*\{[^}]*\}/g) ?? []
const kept = []
const files = new Set()

for (const block of blocks) {
  const weight = block.match(/font-weight:\s*(\d+)/)?.[1]
  if (!WEIGHTS.has(weight)) continue
  const file = block.match(/url\(\.\/woff2-dynamic-subset\/([^)]+)\)/)?.[1]
  if (!file) continue
  files.add(file)
  // woff 폴백 규칙은 버린다 — 대상 브라우저가 전부 woff2 를 읽고, CSS 크기가 절반이 된다.
  kept.push(block.replace(/src:[^;]+;/, `src: url(${PUBLIC_PATH}/${file}) format('woff2');`))
}

if (kept.length === 0) {
  console.error('[copy-pretendard-subset] @font-face 를 하나도 고르지 못했습니다. 패키지 구조를 확인하세요.')
  process.exit(1)
}

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })
await Promise.all(
  [...files].map((file) => copyFile(path.join(staticDir, 'woff2-dynamic-subset', file), path.join(outDir, file)))
)
// 460개 규칙이라 공백만 걷어도 수십 KB가 준다. 이 파일은 렌더를 막는 자리에 있다.
const minified = kept.join('').replace(/\s*([{}:;,])\s*/g, '$1').replace(/\s+/g, ' ')
await writeFile(cssPath, minified, 'utf8')

console.log(`[copy-pretendard-subset] @font-face ${kept.length}개 -> src/app/pretendard-subset.css, 조각 ${files.size}개 -> public${PUBLIC_PATH}/`)
