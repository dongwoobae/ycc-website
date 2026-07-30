import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // prebuild/predev 가 node_modules 에서 복사해 오는 pdfjs 워커 — 우리 코드가 아니다
    "public/pdf.worker.min.mjs",
  ]),
]);

export default eslintConfig;
