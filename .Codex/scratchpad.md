# STIZ 고도화 스크래치패드

## 현재 작업
- 작업명: 정책/푸터/SNS/인스타그램 관리자 제어 확장
- 상태: 완료
- 범위: 개인정보처리방침, 푸터 문구, 소셜 링크, 인스타그램 갤러리 연동 기반
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

## 작업 로그
- 2026-07-06: 개인정보처리방침 관리 페이지, 푸터/SNS 설정, 인스타그램 갤러리 가져오기/자동 업로드 기반 추가.
- 2026-07-06: 공개 페이지 상단 바와 푸터 운영시간을 관리자 설정 `operatingHours`로 제어하도록 변경.
- 2026-07-06: 메인 홈 활동 사진 섹션을 관리자 갤러리 `GalleryPost` 공개 이미지 기준으로 변경.
- 2026-07-06: 프로젝트 현황 파악 및 `.Codex` 기록 구조 생성.

## 구현 기록
- 변경 파일: `prisma/schema.prisma`, `prisma/add-missing-columns.sql`, `src/app/actions/admin.ts`, `src/lib/queries.ts`, `src/lib/defaultPolicies.ts`, `src/lib/instagram.ts`, `src/app/privacy/page.tsx`, `src/app/admin/privacy/*`, `src/app/admin/settings/AdminSettingsClient.tsx`, `src/app/admin/gallery/*`, `src/components/PublicFooter.tsx`, `src/components/PublicPageLayout.tsx`, `src/app/page.tsx`
- `AcademySettings`에 개인정보처리방침, 푸터 문구, SNS 링크, Instagram Business Account ID, 자동 업로드 ON/OFF 필드를 추가.
- `/admin/privacy`에서 개인정보처리방침을 저장하고 `/privacy` 공개 페이지가 DB 값을 표시하도록 변경.
- 공개 푸터가 소개 문구, 저작권 문구, Instagram/YouTube/네이버 플레이스/카카오 채널 링크를 설정값으로 표시.
- 갤러리 관리자에 인스타그램 가져오기 버튼을 추가하고, `GalleryPost`에 인스타그램 출처/발행 메타데이터를 기록할 수 있게 확장.
- 새 공개 갤러리 게시물 생성 시 자동 업로드가 켜져 있고 서버 환경변수가 준비된 경우 Instagram Graph API 발행을 시도.

## 테스트 결과
- `tsc --noEmit --incremental false --pretty false` 통과
- `git diff --check` 통과

## 다음에 할 것
- 운영 환경에 `INSTAGRAM_ACCESS_TOKEN`, 필요 시 `INSTAGRAM_BUSINESS_ACCOUNT_ID` 또는 관리자 설정의 Business Account ID를 등록.
- 실제 Meta 앱 권한과 공개 이미지 URL 조건으로 인스타그램 가져오기/자동 업로드 운영 테스트.
