# STIZ 고도화 스크래치패드

## 현재 작업
- 작업명: 반 상세 데이터 백그라운드 로딩
- 상태: 빌드 검증 완료
- 범위: `/admin/classes/[id]`, `/api/admin/classes/[id]/detail`
- 기준일: 2026-07-10

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 프로젝트 현황 파악 | 완료 | Next.js + Supabase + Prisma 기반 학원 홈페이지/관리 플랫폼 |
| 관리자 권한 보호 | 완료 | `/admin` 서버 레이아웃에서 DB role 기준 권한 확인 |
| 업로드 UX 개선 | 완료 | 병렬 업로드, 진행률 표시, 성공 메시지 보강 |
| 홈 공지/인스타 갤러리 보강 | 완료 | 히어로 공지 목록 추가, Instagram CDN 이미지 허용 |
| 전역 속도 병목 개선 | 완료 | 홈 폰트 preload/아이콘/모달/초기 JS 부담 축소 |
| 관리자 링크 prefetch 차단 | 완료 | 누르지 않은 관리자 route의 배경 조회를 줄임 |
| 관리자 DDL 진입 제거 | 완료 | 읽기 화면에서는 테이블 보장 작업을 실행하지 않도록 이동 |
| 관리자 화면 skeleton/streaming | 완료 | 주요 목록/설정 화면은 skeleton을 먼저 표시 |
| 원생 목록 백그라운드 로딩 | 완료 | `/admin/students` 서버 조회를 클라이언트 API로 분리 |
| 관리자 셸 배경 API 지연 | 완료 | 체험 신청/알림 조회를 idle 이후로 지연 |
| 원생 상세 백그라운드 로딩 | 완료 | 원생 활동/출석/결제/갤러리 조회를 클라이언트 API로 분리 |
| 반 상세 백그라운드 로딩 | 완료 | 반/수강생/수업기록/코치 조회를 클라이언트 API로 분리 |
| 타입/빌드 검증 | 완료 | `npx.cmd tsc --noEmit`, `npx.cmd next build` 통과 |

## 작업 로그
- 2026-07-10: `/admin/classes/[id]` 진입 시 반/수강생/수업기록/코치 조회를 서버 렌더에서 제거하고, `/api/admin/classes/[id]/detail`로 클라이언트에서 불러오도록 변경함.
- 2026-07-10: `/admin/students/[id]` 상세 진입 시 활동/출석/결제/갤러리 조회를 서버 렌더에서 제거하고, `/api/admin/students/[id]/activity`로 클라이언트에서 불러오도록 변경함.
- 2026-07-10: 관리자 공통 셸의 체험 신청 수/알림 조회를 첫 렌더 직후가 아니라 idle 이후 천천히 실행하고 알림 폴링 간격을 완화함.
- 2026-07-10: `/admin/students` 진입 시 원생/반 전체 목록 조회를 서버 렌더에서 제거하고, `/api/admin/students`를 통해 클라이언트에서 천천히 불러오도록 변경함.
- 2026-07-10: `/admin/skills` 진입 시 스킬 카테고리 조회를 Suspense 안쪽으로 옮기고, table skeleton을 먼저 렌더하도록 변경함.
- 2026-07-10: `/admin/staff` 진입 시 스태프/코치/초대 목록 조회를 Suspense 안쪽으로 옮기고, list skeleton을 먼저 렌더하도록 변경함.
- 2026-07-10: `/admin/privacy`, `/admin/terms` 진입 시 약관/개인정보 설정 조회를 Suspense 안쪽으로 옮기고, editor skeleton을 먼저 렌더하도록 변경함.
- 2026-07-10: `/admin/settings` 진입 시 학원 설정 조회를 Suspense 안쪽으로 옮기고, 설정 폼 skeleton을 먼저 렌더하도록 변경함.
- 2026-07-10: `/admin/schedule` 진입 시 설정/시간표 override/코치/직접 슬롯/프로그램/Google Sheets 조회를 Suspense 안쪽으로 옮기고, skeleton을 먼저 렌더하도록 변경함.
- 2026-07-10: 관리자 내부 반/출석/리포트/갤러리/설정 이동 링크에 `prefetch={false}`를 추가해 불필요한 배경 route 조회를 차단함.

## 구현 기록
- 변경 파일: `src/app/admin/classes/[id]/page.tsx`, `src/app/admin/classes/[id]/ClassDetailClient.tsx`, `src/app/api/admin/classes/[id]/detail/route.ts`
- 주요 변경: 반 상세의 무거운 조회를 클라이언트 API로 분리하고, 저장 후에는 전체 페이지 새로고침 대신 상세 데이터만 다시 조회.
- 적용 범위: `/admin/classes/[id]`

## 테스트 결과
- `npx.cmd tsc --noEmit` 통과
- `npx.cmd next build` 통과
- 빌드 중 Supabase DB 접속 실패 로그는 로컬 네트워크 제한으로 발생했지만 fallback 처리되어 빌드 종료 코드는 0.

## 다음에 할 것
- 다음 속도 개선 후보: 빌드 중 여전히 DB 조회 로그가 많은 관리자 화면을 골라 서버 렌더 의존을 더 줄이기.
