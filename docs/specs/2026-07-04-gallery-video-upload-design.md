# 갤러리 영상 업로드 설계

날짜: 2026-07-04
상태: 승인됨

## 목적

관리자가 갤러리 앨범에 휴대폰 촬영 짧은 클립(수십초~수분, 최대 200MB)을 사진과 함께 올리고,
방문자가 갤러리 그리드·라이트박스에서 재생할 수 있게 한다.

## 배경·제약

- Vercel 서버리스 함수는 요청 본문 약 4.5MB 제한 → 영상은 서버를 거칠 수 없다.
- R2는 이그레스 무료·저장 10GB 무료 → 직접 서빙에 비용 부담 없음.
- Vercel에서 ffmpeg 트랜스코딩은 비현실적 → 서버 트랜스코딩 없음(원본 그대로 서빙).
- 대안 비교: Cloudflare Stream(자동 트랜스코딩, 유료 월 $5+)과 YouTube 임베드(관리자 UX 나쁨)는
  짧은 클립 + 무료 운영 요구에 맞지 않아 배제. **R2 presigned 직접 업로드 채택.**

## 1. DB 스키마

`gallery_images` 테이블에 컬럼 2개 추가 (Drizzle 마이그레이션):

| 컬럼 | 타입 | 기본값 | 용도 |
|---|---|---|---|
| `media_type` | text, not null | `'image'` | `'image' \| 'video'` 구분 |
| `poster_url` | text, nullable | null | 영상 썸네일(포스터) URL. 영상일 때만 사용 |

- 영상 파일 URL은 기존 `image_url` 컬럼에 저장한다 → 정렬·삭제·순서변경·목록 조회 로직 전부 재사용.
- 별도 테이블 없음. 기존 행은 기본값 `'image'`로 무변경.

## 2. 업로드 흐름 (영상)

```
[관리자 브라우저]                         [Vercel]                [R2]
  영상 선택 (mp4/mov/webm, ≤200MB)
  ── presign 요청 ──────────────────▶ 서버 액션: 세션·타입·크기 검증
  ◀─ presigned PUT URL + 공개 URL ──  (@aws-sdk/s3-request-presigner)
  ── XHR PUT (진행률 %) ─────────────────────────────────────────▶ 영상 저장
  <video>+canvas 첫 프레임 추출
  ── 포스터 업로드 ─────────────────▶ 기존 /api/admin/gallery/upload ▶ 포스터 저장(webp)
  ── DB 저장 액션 ──────────────────▶ gallery_images insert
                                      (mediaType='video', posterUrl)
```

- **presign 서버 액션**: 관리자 세션 확인 → 확장자·MIME(mp4/quicktime/webm)·크기(≤200MB) 검증 →
  `gallery/` prefix 키 생성(기존 `galleryImageKey`와 같은 규칙, 원본 확장자 유지) →
  presigned PUT URL(만료 10분 내외)과 최종 공개 URL 반환.
- **직접 업로드**: XHR로 진행률 표시. 실패 시 에러 메시지, 재시도는 수동(다시 제출).
- **포스터**: 클라이언트에서 첫 프레임(재생 가능 시점)을 canvas로 캡처 → JPEG Blob →
  기존 이미지 업로드 API 재사용(WebP 변환·리사이즈 포함). 포스터 추출 실패 시(코덱 미지원 등)
  포스터 없이 저장하고 그리드에서는 기본 플레이스홀더 + ▶ 아이콘 표시.
- **DB 저장**: 새 서버 액션 `saveVideoRecord(videoUrl, posterUrl, caption, alt)` — sortOrder는
  기존 이미지 저장과 동일하게 순차 부여.

### 검증의 한계와 보강 (codex 리뷰 반영)

직접 업로드라 서버가 파일 내용을 스니핑할 수 없고, presigned PUT은 Content-Length를
서명하지 않아 선언 크기와 실제 크기가 다를 수 있다. 이를 다음 두 겹으로 보강한다:

1. **Content-Type 서명 강제**: presigned URL의 `X-Amz-SignedHeaders`에 content-type이
   포함되는지 단위 테스트로 고정 (가정이 아닌 검증된 불변식으로).
2. **업로드 후 실물 검증**: `addVideoRecord`가 R2 HeadObject로 객체 존재·실제 크기(≤200MB)·
   실제 Content-Type(video/*)을 확인하고, 위반 시 R2에서 즉시 삭제 + 에러.

나머지(파일 내용이 진짜 영상인지)는 관리자 전용 기능이라는 신뢰 경계로 허용한다.

## 3. 관리자 UI (`GalleryImageManager`)

- 기존 "사진 추가" 카드는 그대로. 그 아래 **"영상 추가" 카드를 별도 폼으로 추가**:
  - `<input type="file" accept="video/mp4,video/quicktime,video/webm">` (단일 파일)
  - 캡션·대체 텍스트 입력
  - 업로드 진행률 바(%) — 압축 단계 없음
  - 안내 문구: "mp4(H.264) 권장 — iPhone 원본(.mov, HEVC)은 일부 기기에서 재생되지 않을 수 있습니다. 최대 200MB."
- 목록: 영상 항목은 포스터 이미지 + ▶ 배지 표시. 캡션 수정·삭제·순서변경은 사진과 동일 동작.
- 삭제: 영상은 R2에서 `imageUrl`(영상)과 `posterUrl`(포스터) **둘 다** 삭제하도록 기존 삭제
  액션 확장 (`keyFromUrl` 재사용).

## 4. 공개 갤러리 표시

- **그리드(`GalleryGrid`)**: 영상 항목은 `posterUrl`을 썸네일로, 중앙에 재생 아이콘 오버레이.
  포스터는 `next/image` 그대로 사용(영상 파일은 이미지 최적화 대상 아님).
- **라이트박스**: 현재 항목이 영상이면 `<video controls playsInline preload="metadata" poster={posterUrl}>`
  렌더. 좌우 이동·닫기 시 재생 정지(요소 언마운트로 처리). 사진과 동일한 키보드 내비 유지.
- **썸네일 스트립**: 포스터 사용, 없으면 플레이스홀더.
- 앨범 커버(`coverImgUrl`)는 기존 로직 유지 — 영상 포스터를 커버로 쓰는 건 범위 외.

## 5. 에러 처리

| 상황 | 처리 |
|---|---|
| 타입·크기 검증 실패 | 클라이언트에서 선차단 + presign 액션에서 재검증(에러 메시지 반환) |
| R2 PUT 실패(네트워크/CORS) | 진행률 바 에러 상태 + 메시지. DB에 레코드 남기지 않음 |
| 포스터 추출 실패 | 포스터 없이 저장(경고 없음), 표시 측 플레이스홀더 |
| DB 저장 실패 | 에러 표시. R2에 고아 파일이 남을 수 있으나 관리자 기능 특성상 허용(기존 이미지 흐름과 동일한 트레이드오프) |

## 6. 테스트

- 단위(vitest): presign 액션의 검증 로직(타입·크기·키 prefix), 영상 키 생성 규칙,
  삭제 시 영상+포스터 키 도출.
- e2e(playwright): 기존 `gallery-upload.spec.ts` 패턴을 따라 영상 추가 폼 렌더·검증 동작 확인
  (실제 R2 업로드는 mock 또는 skip — 기존 e2e 관례를 따름).

## 7. 운영 준비물 (배포 전 1회)

- **R2 버킷 CORS 설정**: 사이트 도메인(`https://www.ycjc.kr`, 프리뷰/로컬 포함)에서
  `PUT` 허용. Cloudflare 대시보드에서 설정. 구현 완료 시 설정값 문서 제공.
- 신규 의존성: `@aws-sdk/s3-request-presigner` (기존 `@aws-sdk/client-s3`와 동일 버전 계열).

## 범위 외

- 서버 트랜스코딩·HLS 스트리밍 (필요해지면 Cloudflare Stream 재검토)
- 영상 다중 선택 병렬 업로드 (1개씩 업로드; 필요 시 후속)
- 앨범 커버로 영상 포스터 지정
