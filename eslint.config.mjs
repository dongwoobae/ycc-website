import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // prebuild/predev 가 node_modules 에서 복사해 오는 pdfjs 워커 — 우리 코드가 아니다
    'public/pdf.worker.min.mjs',
  ]),
  {
    // next/og(Satori)가 이 JSX를 DOM이 아니라 PNG로 그린다 — next/image 도,
    // alt 를 읽을 스크린리더도 없는 자리다.
    files: ['src/lib/thumbnails/render.tsx'],
    rules: {
      '@next/next/no-img-element': 'off',
      'jsx-a11y/alt-text': 'off',
    },
  },
])

export default eslintConfig
