# STIZ 고도화 스크래치패드

## 현재 작업
- 작업명: 관리자 대시보드 읽기 캐시 및 자동 호출 축소
- 상태: 타입/빌드 검증 완료
- 범위: `/admin` 대시보드 API, 시스템 상태 API, 관리자 공통 알림 버튼
- 기준일: 2026-07-11

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 프로젝트 현황 파악 | 완료 | Next.js + Supabase + Prisma 기반 학원 홈페이지/관리 플랫폼 |
| 관리자 권한 보호 | 완료 | `/admin` 서버 레이아웃에서 DB role 기반 권한 확인 |
| 관리자 링크 prefetch 차단 | 완료 | 보이지 않는 관리자 route의 배경 조회를 줄임 |
| 관리자 DDL 진입 제거 | 완료 | 읽기 화면에서 테이블/인덱스 보장 작업을 실행하지 않음 |
| 관리자 데이터 지연 로딩 | 완료 | 무거운 조회는 API 로딩으로 분리 |
| 관리자 인증 경량화 | 완료 | Supabase `getClaims()` 우선 사용, DB role 조회 30초 캐시 |
| 대시보드 읽기 캐시 | 완료 | `/api/admin/dashboard` 15초 서버 캐시와 private browser cache 적용 |
| 시스템 상태 지연 점검 | 완료 | `/api/admin/dashboard/system` 5분 서버 캐시, 첫 화면 자동 호출 제거 |
| 알림 자동 폴링 제거 | 완료 | 알림 버튼 클릭 시에만 `/api/admin/notifications` 조회 |
| 타입/빌드 검증 | 완료 | `npx.cmd tsc --noEmit`, `npx.cmd next build` 통과 |

## 작업 로그
- 2026-07-11: `/api/admin/dashboard`의 `force-dynamic`/`no-store`를 제거하고 15초 `unstable_cache`를 적용해 동일한 관리자 읽기 조회를 짧게 재사용하도록 변경.
- 2026-07-11: `/api/admin/dashboard/system`은 5분 서버 캐시로 바꾸고, 대시보드 첫 진입 자동 호출을 제거해 사용자가 “확인”을 눌렀을 때만 DB/백업 상태를 점검하도록 변경.
- 2026-07-11: 관리자 공통 헤더의 알림 자동 idle 조회와 120초 폴링을 제거해 모든 관리자 페이지 진입 시 배경 API 경합을 줄임.
- 2026-07-11: 관리자 셸의 `/api/admin/performance-indexes` 자동 호출 제거, Supabase 인증 `getClaims()` 우선 사용, DB role 조회 30초 캐시 적용.
- 2026-07-10: `/api/admin/students`의 학생별 Enrollment 반복 조회를 CTE 집계로 변경해 학생 목록 응답 부담을 줄임.
- 2026-07-10: 주요 관리자 화면의 서버 직접 조회를 skeleton/API 기반 로딩으로 분리하고 내부 링크 prefetch를 꺼서 배경 DB 조회를 줄임.
- 2026-07-10: 공개 홈페이지의 폰트 preload, 인라인 스크립트, 클릭 후 열리는 UI 초기 JS 부담을 줄임.

## 구현 기록
- 변경 파일: `src/app/api/admin/dashboard/route.ts`, `src/app/api/admin/dashboard/system/route.ts`, `src/app/admin/AdminDashboardClient.tsx`, `src/app/admin/AdminShellClient.tsx`
- 주요 변경: 관리자 확인 후 대시보드 읽기 결과를 짧게 캐시하고, 시스템 상태와 알림 조회는 첫 화면 자동 실행 대신 사용자 동작 기반으로 전환.
- 의도: 홈페이지처럼 정적화할 수 없는 관리자 페이지에서, 실제 DB 조회 횟수와 첫 진입 시 동시에 몰리는 API 수를 줄인다.

## 테스트 결과
- `npx.cmd tsc --noEmit` 통과
- `npx.cmd next build` 통과
- 빌드 중 Supabase pooler 접속 경고가 출력됐지만 기존 공개 페이지 프리렌더 fallback 경고이며 종료 코드는 0

## 다음에 할 것
- 실제 배포 환경에서 `/admin` 첫 진입 Network waterfall을 확인하고, 아직 느린 API가 남으면 해당 route별 DB 쿼리 시간과 payload 크기를 따로 측정한다.
