# STIZ 고도화 스크래치패드

## 현재 작업
- 작업명: 운영시간 관리자 설정 연동
- 상태: 완료
- 범위: 공개 페이지 상단 바와 푸터 운영시간을 `AcademySettings.operatingHours`로 제어
- 기준일: 2026-07-06

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 프로젝트 현황 파악 | 완료 | Next.js 16 + Supabase + Prisma 기반 학원 운영 플랫폼 |
| 기록 구조 생성 | 완료 | `.Codex` 폴더와 knowledge 문서 생성 |
| 홈페이지/관리자 갭 점검 | 완료 | 갤러리 분리, 개인정보처리방침, 운영시간 등 갭 확인 |
| 메인 갤러리 통합 | 완료 | `/`가 공개 `GalleryPost` 이미지 데이터를 사용 |
| 운영시간 관리자 설정 연동 | 완료 | 관리자 설정값을 공개 헤더/푸터에 반영 |
| 인스타그램 연동 | 예정 | Meta 계정/권한 준비 후 설계 |

## 작업 로그
- 2026-07-06: 공개 페이지 상단 바와 푸터 운영시간을 관리자 설정 `operatingHours`로 제어하도록 변경.
- 2026-07-06: 메인 홈 활동 사진 섹션을 관리자 갤러리 `GalleryPost` 공개 이미지 기준으로 변경.
- 2026-07-06: 프로젝트 현황 파악 및 `.Codex` 기록 구조 생성.

## 구현 기록
- 변경 파일: `prisma/schema.prisma`, `src/app/actions/admin.ts`, `src/lib/queries.ts`, `src/app/admin/settings/AdminSettingsClient.tsx`, `src/components/PublicHeader.tsx`, `src/components/PublicFooter.tsx`, `src/components/PublicPageLayout.tsx`, `src/app/page.tsx`
- `AcademySettings`에 `operatingHours` 필드를 추가하고, 관리자 설정 저장 허용 목록에 포함.
- 관리자 설정 화면에 운영시간 입력칸을 추가.
- 공개 헤더와 푸터가 설정값을 우선 사용하고, 값이 비어 있으면 기본 운영시간을 표시.
- 설정 저장 후 공개 페이지들이 다시 갱신되도록 관련 경로를 함께 revalidate.

## 테스트 결과
- `tsc --noEmit --incremental false --pretty false` 통과
- `git diff --check` 통과

## 다음에 할 것
- 개인정보처리방침, 푸터 문구, 소셜 링크를 관리자 설정으로 편입.
- 인스타그램 기존 게시물 가져오기/자동 업로드 설계 및 구현.
