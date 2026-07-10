# STIZ Codex Scratchpad

## 현재 작업
- 작업명: 관리자 주요 메뉴 초기 데이터 왕복 제거
- 상태: 구현 및 검증 완료, 커밋 준비 중
- 범위: `/admin/students`, `/admin/classes`, `/admin/trial`, 관리자 읽기 payload 공용화
- 기준일: 2026-07-11

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 프로젝트 현황 파악 | 완료 | Next.js + Supabase + Prisma 기반 학원 홈페이지/관리 플랫폼 |
| 관리자 권한 보호 | 완료 | `/admin` 서버 레이아웃에서 DB role 기반 권한 확인 |
| 관리자 링크 prefetch 차단 | 완료 | 보이지 않는 관리자 route 배경 조회 감소 |
| 관리자 DDL 진입 제거 | 완료 | 읽기 화면에서 테이블/인덱스 보장 작업 제거 |
| 관리자 인증 경량화 | 완료 | Supabase `getClaims()` 우선 사용, role 조회 단기 캐시 |
| 관리자 공통 배경 조회 제거 | 완료 | 알림은 클릭 시 조회, trial-count 자동 조회 제거 |
| Google Sheets 수동 동기화 | 완료 | 화면은 DB 캐시만 읽고 수동 버튼으로 외부 시트 동기화 |
| 관리자 읽기 API 캐시 | 완료 | dashboard/finance/stats/content/operation API 서버 캐시 적용 |
| 주요 메뉴 초기 데이터 주입 | 완료 | students/classes/trial 첫 진입 API 재호출 제거 |
| 검증 | 완료 | `npx.cmd tsc --noEmit`, `npm.cmd run build` 통과 |

## 작업 로그
- 2026-07-11: `/admin/students`, `/admin/classes`, `/admin/trial` 페이지가 서버에서 캐시된 초기 데이터를 받아 렌더링하도록 바꾸고, 첫 진입 시 같은 API를 클라이언트에서 다시 호출하던 왕복을 제거.
- 2026-07-11: DB 계측 결과 SQL 자체보다 반복 API/auth/왕복 비용이 병목에 가까워, 전역 `trial-count` 자동 조회 제거 및 운영 데이터 API 6개에 서버 캐시 적용.
- 2026-07-11: 프로그램/코치/FAQ/연간일정/SMS 템플릿/청구 템플릿 관리자 API에 60초 서버 캐시 적용 및 저장 액션 캐시 무효화.
- 2026-07-11: Google Sheets 시간표 자동 cron 제거, 관리자 수동 동기화 버튼으로 `SheetSlotCache` 저장 후 화면은 DB 캐시만 읽도록 전환.
- 2026-07-11: `/api/admin/finance`, `/api/admin/stats`에 단기 private/server cache 적용 및 관련 저장 작업 후 캐시 무효화.
- 2026-07-11: `/api/admin/dashboard` 15초 cache, `/api/admin/dashboard/system` 수동 확인형으로 변경.
- 2026-07-11: 관리자 공통 헤더의 알림 자동 조회와 DDL/index 자동 보장 호출 제거.

## 구현 기록
- 변경 파일: `src/lib/adminReadPayloads.ts`, `src/app/admin/students/page.tsx`, `src/app/admin/classes/page.tsx`, `src/app/admin/trial/page.tsx`, `src/app/admin/students/StudentManagementClient.tsx`, `src/app/api/admin/students/route.ts`, `src/app/api/admin/classes/route.ts`, `src/app/api/admin/trial/route.ts`
- 주요 변경: 캐시된 관리자 읽기 payload를 공용 서버 헬퍼로 분리하고, API route와 서버 페이지가 같은 캐시 키/태그를 공유하게 했다.
- 주요 변경: 수강생 화면은 초기 데이터가 있으면 첫 `useEffect` API 재호출을 건너뛰게 했다.
- 의도: 이미 빠른 DB 캐시가 있어도 브라우저가 JS 실행 후 같은 API를 한 번 더 호출하던 왕복을 줄여 관리자 메뉴 첫 표시를 빠르게 만든다.

## 테스트 결과
- `npx.cmd tsc --noEmit` 통과
- `npm.cmd run build` 통과
- 빌드 중 Supabase pooler 접속 경고가 출력됐지만 기존 정적 페이지 fallback 경고이며 종료 코드는 0

## 다음에 할 것
- 실제 로그인 세션에서 `/admin/students`, `/admin/classes`, `/admin/trial` Network waterfall을 확인해 초기 API 재호출이 사라졌는지 검증.
- 남은 느린 화면은 “초기 데이터가 필요한 화면”과 “클릭할 때만 필요한 보조 데이터”로 더 분리.
