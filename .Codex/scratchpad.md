# STIZ 고도화 스크래치패드

## 현재 작업
- 작업명: 메인 홈 갤러리 관리자 갤러리 통합
- 상태: 완료
- 범위: 홈 화면 활동 사진 섹션 데이터 출처를 `GalleryPost`로 변경
- 기준일: 2026-07-06

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 프로젝트 현황 파악 | 완료 | Next.js 16 + Supabase + Prisma 기반 학원 운영 플랫폼 |
| 기록 구조 생성 | 완료 | `.Codex` 폴더와 knowledge 문서 생성 |
| 홈페이지/관리자 갭 점검 | 완료 | 갤러리 분리, 개인정보처리방침, 운영시간 등 갭 확인 |
| 메인 갤러리 통합 | 완료 | `/`가 공개 `GalleryPost` 이미지 데이터를 사용 |
| 인스타그램 연동 | 예정 | Meta 계정/권한 준비 후 설계 |

## 작업 로그
- 2026-07-06: 메인 홈 활동 사진 섹션을 관리자 갤러리 `GalleryPost` 공개 이미지 기준으로 변경.
- 2026-07-06: 프로젝트 현황 파악 및 `.Codex` 기록 구조 생성.

## 구현 기록
- 변경 파일: `src/app/page.tsx`, `src/app/LandingPageClient.tsx`
- `page.tsx`: `getGalleryPosts({ limit: 12, publicOnly: true })`를 함께 조회해 홈 클라이언트로 전달.
- `LandingPageClient.tsx`: `mediaJSON`에서 이미지 URL을 추출해 메인 갤러리 섹션에 표시.
- 관리자 설정의 `galleryImagesJSON`은 이번 단계에서 삭제하지 않고, 홈 표시 기준만 `GalleryPost`로 전환.

## 테스트 결과
- `tsc --noEmit --incremental false --pretty false` 통과

## 다음에 할 것
- 개인정보처리방침, 운영시간, 푸터 문구, 소셜 링크를 관리자 설정으로 편입.
- 인스타그램 기존 게시물 가져오기/자동 업로드 설계 및 구현.
