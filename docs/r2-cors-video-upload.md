# R2 CORS 설정 — 갤러리 영상 직접 업로드 (배포 전 1회)

영상은 브라우저가 R2 버킷에 presigned URL로 직접 PUT 한다.
브라우저 cross-origin 요청이므로 버킷에 CORS 정책이 없으면 업로드가 전부 실패한다.

## 설정 방법

Cloudflare 대시보드 → R2 → 해당 버킷 → Settings → CORS Policy → Edit:

```json
[
  {
    "AllowedOrigins": [
      "https://www.ycjc.kr",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

- `AllowedHeaders`는 `["*"]`로 둔다 — SDK 버전에 따라 `x-amz-content-sha256` 등
  서명 헤더가 추가될 수 있는데, 헤더 allowlist가 좁으면 preflight에서 막힌다.
  인증 경계는 CORS가 아니라 presigned URL 서명이므로 넓혀도 안전하다.
- Vercel 프리뷰 배포에서도 테스트하려면 `"https://*.vercel.app"`를 AllowedOrigins에 추가
  (와일드카드가 안 먹으면 해당 프리뷰 도메인을 정확히 추가).
- GET은 불필요 — 영상 재생은 R2 공개 URL(R2_PUBLIC_URL) 단순 요청이라 CORS 대상이 아니다.
- 설정 후 확인: 관리자 → 갤러리 앨범 수정 → 영상 추가로 mp4 업로드가 100%까지 진행되면 성공.
  실패 시 브라우저 콘솔에 CORS 에러가 찍힌다.
