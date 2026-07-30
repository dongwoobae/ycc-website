// pdfjs-dist 의 워커를 public/ 으로 복사한다.
//
// 번들러의 new Worker() 처리에 의존하지 않는 이유: Turbopack 개발 서버와 프로덕션
// 번들에서 동작이 갈릴 수 있고, 실패하면 원인 파악이 어렵다. public/ 에 놓고
// workerSrc 로 직접 가리키면 실패 지점이 "파일이 있나" 하나로 줄어든다.
//
// predev/prebuild 에서 돌기 때문에 pdfjs-dist 를 올릴 때 따로 챙길 일이 없다.

import { copyFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const candidates = ['pdf.worker.min.mjs', 'pdf.worker.mjs']

const pkgPath = require.resolve('pdfjs-dist/package.json')
const buildDir = path.join(path.dirname(pkgPath), 'build')
const publicDir = path.join(process.cwd(), 'public')

let copied = false
for (const name of candidates) {
  try {
    await mkdir(publicDir, { recursive: true })
    await copyFile(path.join(buildDir, name), path.join(publicDir, 'pdf.worker.min.mjs'))
    console.log(`[copy-pdf-worker] ${name} -> public/pdf.worker.min.mjs`)
    copied = true
    break
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

if (!copied) {
  console.error(`[copy-pdf-worker] 워커 파일을 찾지 못했습니다. 확인 대상: ${buildDir}`)
  process.exit(1)
}
