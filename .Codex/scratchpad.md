# STIZ 고도화 스크래치패드

## 현재 작업
- 작업명: 관리자 진입 속도 재점검
- 상태: 타입/빌드 검증 완료
- 범위: 관리자 공통 셸, Supabase 인증 가드, 관리자 성능 인덱스 API
- 기준일: 2026-07-11

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 프로젝트 현황 파악 | 완료 | Next.js + Supabase + Prisma 기반 학원 홈페이지/관리 플랫폼 |
| 관리자 권한 보호 | 완료 | `/admin` 서버 레이아웃에서 DB role 기준 권한 확인 |
| 관리자 링크 prefetch 차단 | 완료 | 누르지 않은 관리자 route의 배경 조회를 줄임 |
| 관리자 DDL 진입 제거 | 완료 | 읽기 화면에서는 테이블/컬럼 보장 작업을 실행하지 않도록 이동 |
| 관리자 화면 skeleton/streaming | 완료 | 주요 목록/설정 화면은 skeleton을 먼저 표시 |
| 관리자 데이터 백그라운드 로딩 | 완료 | 대시보드/학생/반/수납/출석/설정 등 무거운 조회를 API 로딩으로 분리 |
| 수강생 목록 API 쿼리 최적화 | 완료 | `getStudents()`의 학생별 수강정보 반복 조회를 CTE 전체 집계로 변경 |
| 관리자 자동 인덱스 실행 제거 | 완료 | 관리자 셸 idle 시점의 `/api/admin/performance-indexes` 호출 제거 |
| 관리자 인증 경량화 | 완료 | Supabase `getClaims()` 우선 사용, DB role 조회 30초 캐시 추가 |
| 타입/빌드 검증 | 완료 | `npx.cmd tsc --noEmit`, `npx.cmd next build` 통과 |

## 작업 로그
- 2026-07-11: 관리자 셸에서 idle 시점에 자동 실행되던 `/api/admin/performance-indexes` 호출과 API route를 제거해 운영 화면에서 DB 인덱스 생성 작업이 돌지 않게 함.
- 2026-07-11: `requireAuth()`와 미들웨어 인증 확인을 Supabase `getClaims()` 우선 흐름으로 바꿔 매 요청마다 Auth 서버로 `getUser()` 왕복하는 부담을 줄임.
- 2026-07-11: 관리자/스태프/원장 권한 확인의 DB `User` role 조회에 30초 서버 메모리 캐시를 추가해 같은 사용자의 반복 권한 조회를 줄임.
- 2026-07-11: 관리자 공통 셸의 알림/체험 신청 배지 API도 `requireAdmin()`을 공유하게 바꿔 직접 `getUser()` 호출과 role 중복 조회를 줄임.
- 2026-07-10: `/api/admin/students`가 사용하는 `getStudents()` 쿼리를 학생별 subquery 반복에서 Enrollment CTE 전체 집계로 바꿔 수강생 목록 응답 부담을 줄임.
- 2026-07-10: 관리자 공통 셸의 체험 신청 수/알림 조회를 첫 렌더 직후 실행하지 않고 idle 이후로 늦춰 초기 DB 요청 경합을 줄임.
- 2026-07-10: `/admin/students`, `/admin/classes`, `/admin/gallery`, `/admin/settings` 등 주요 관리자 화면의 서버 렌더 조회를 API 기반 지연 로딩으로 분리함.
- 2026-07-10: 관리자 내부 이동 링크와 상세 링크에 `prefetch={false}`를 적용해 보이지 않는 화면의 배경 DB 조회를 줄임.
- 2026-07-10: 관리자 읽기 화면에서 테이블/컬럼 보장용 DDL 호출을 제거하고 쓰기 작업의 lazy 보장으로 이동함.
- 2026-07-10: 공개 홈페이지의 전역 폰트 preload, 외부 스크립트, 클릭 후 쓰는 UI의 초기 JS 부담을 줄임.
- 2026-07-10: 갤러리 업로드 진행률/성공 메시지와 권한 오류 표시를 폼 내부에서 처리하도록 개선함.

## 구현 기록
- 변경 파일: `src/app/admin/AdminShellClient.tsx`, `src/app/admin/layout.tsx`, `src/app/api/admin/notifications/route.ts`, `src/app/api/admin/trial-count/route.ts`, `src/lib/auth-guard.ts`, `src/lib/supabase/middleware.ts`, `src/app/api/admin/performance-indexes/route.ts`
- 주요 변경: 관리자 화면에서 DB 인덱스 생성 API를 자동 실행하지 않게 제거하고, Supabase 인증 확인은 `getClaims()`를 먼저 사용한다. 관리자 role 조회는 짧은 캐시를 둬 반복 요청 비용을 줄인다.
- 적용 범위: 관리자 진입, 관리자/스태프 권한 확인, 로그인 리다이렉트 미들웨어

## 테스트 결과
- `npx.cmd next build` 통과
- `npx.cmd tsc --noEmit` 통과

## 다음에 할 것
- 실제 배포 환경에서 관리자 첫 진입/메뉴 이동 API 응답 시간을 확인하고, 느린 API가 남으면 해당 쿼리 단위로 추가 최적화한다.
