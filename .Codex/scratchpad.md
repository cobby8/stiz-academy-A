# STIZ 고도화 스크래치패드

## 현재 작업
- 작업명: 관리자 설정 포토 갤러리 입력 정리
- 상태: 완료
- 범위: `GalleryPost`와 연결되지 않는 기존 `galleryImagesJSON` 입력 UI 제거
- 기준일: 2026-07-06

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 프로젝트 현황 파악 | 완료 | Next.js 16 + Supabase + Prisma 기반 학원 운영 플랫폼 |
| 기록 구조 생성 | 완료 | `.Codex` 폴더와 knowledge 문서 생성 |
| 홈페이지/관리자 갭 점검 | 완료 | 갤러리 분리, 개인정보처리방침, 운영시간 등 갭 확인 |
| 메인 갤러리 통합 | 완료 | `/`가 공개 `GalleryPost` 이미지 데이터를 사용 |
| 운영시간 관리자 설정 연동 | 완료 | 관리자 설정값을 공개 헤더/푸터에 반영 |
| 개인정보처리방침 관리 | 완료 | `/admin/privacy`에서 `/privacy` 문구 관리 |
| 푸터/SNS 관리자 설정 | 완료 | 푸터 소개/저작권/SNS 링크를 설정값으로 반영 |
| 인스타그램 연동 기반 | 완료 | 기존 게시물 가져오기 및 새 갤러리 자동 업로드 구조 추가 |
| 관리자 설정 갤러리 입력 정리 | 완료 | 설정 화면에서 전용 갤러리 관리로 안내 |

## 작업 로그
- 2026-07-06: 관리자 설정의 오래된 포토 갤러리 URL 입력을 제거하고 `/admin/gallery` 안내로 교체.
- 2026-07-06: 개인정보처리방침 관리 페이지, 푸터/SNS 설정, 인스타그램 갤러리 가져오기/자동 업로드 기반 추가.
- 2026-07-06: 공개 페이지 상단 바와 푸터 운영시간을 관리자 설정 `operatingHours`로 제어하도록 변경.
- 2026-07-06: 메인 홈 활동 사진 섹션을 관리자 갤러리 `GalleryPost` 공개 이미지 기준으로 변경.
- 2026-07-06: 프로젝트 현황 파악 및 `.Codex` 기록 구조 생성.

## 구현 기록
- 변경 파일: `src/app/admin/settings/AdminSettingsClient.tsx`, `src/app/LandingPageClient.tsx`
- `/admin/settings`의 포토 갤러리 URL 배열 입력과 `galleryImagesJSON` 저장 코드를 제거.
- 같은 위치에 `/admin/gallery` 이동 안내를 추가해 실제 관리 위치를 명확히 표시.
- `LandingPageClient`의 오래된 `galleryImagesJSON` 주석을 `GalleryPost` 기준으로 수정.

## 테스트 결과
- `tsc --noEmit --incremental false --pretty false` 통과
- `git diff --check` 통과

## 다음에 할 것
- 운영 환경에 `INSTAGRAM_ACCESS_TOKEN`, 필요 시 `INSTAGRAM_BUSINESS_ACCOUNT_ID` 또는 관리자 설정의 Business Account ID를 등록.
- 실제 Meta 앱 권한과 공개 이미지 URL 조건으로 인스타그램 가져오기/자동 업로드 운영 테스트.
