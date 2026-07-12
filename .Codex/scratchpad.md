# STIZ Codex Scratchpad

## 현재 작업
- 작업명: 관리자 페이지 속도 추가 점검
- 상태: 구현 완료, 검증 완료
- 범위: 원생/체험 CRM/수강 신청 목록 렌더링, 관리자 조회 인덱스, DB push 스크립트
- 기준일: 2026-07-12

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 원생 목록 배경 조회 | 완료 | 최초 50명 후 자동 전체 로딩 제거, 버튼 클릭 시에만 전체 목록 조회 |
| 긴 목록 렌더링 | 완료 | 체험 CRM/수강 신청은 최초 50건만 표시하고 더 보기로 점진 렌더링 |
| 브라우저 계산량 | 완료 | 원생 상태 계산을 정렬 반복에서 캐시/단일 순회 방식으로 변경 |
| DB 인덱스 | 완료 | 관리자 조회 패턴용 Prisma 인덱스와 SQL 적용 파일 추가 |
| DB 적용 | 보류 | live DB push는 자동 승인 차단. 사용자 명시 승인 필요 |
| 검증 | 완료 | `prisma validate`, `tsc --noEmit`, `npm run build` 통과 |

## 작업 로그
- 2026-07-12: 관리자 속도 추가 점검으로 원생 자동 전체 재조회 제거, 체험/수강신청 점진 렌더링, 원생 상태 계산 캐시, 관리자 조회용 DB 인덱스/SQL 파일을 추가했다. live DB push는 별도 명시 승인 필요.
- 2026-07-12: 홈페이지 첫 방문 기본 테마를 `system`에서 `dark`로 변경했다. 저장된 사용자 선택이 없는 경우 다크모드로 시작하고, 사용자가 토글로 바꾼 선택은 유지된다.
- 2026-07-12: 다크모드 전역 글자 대비 문제를 조사해 `body`의 잘못된 `dark:bg-brand-neon-lime dark:text-brand-navy-900` 적용을 제거하고, 전역 CSS 안전망으로 기본 배경/글자/입력창/hover 대비를 보정했다. `npx.cmd tsc --noEmit`, `npm.cmd run build` 통과.
- 2026-07-12: `/admin/gallery` 첫 진입 체감을 위해 초기 데이터가 있으면 클라이언트 재 refresh를 생략하고, 갤러리 카드는 최초 12개만 렌더링한 뒤 더 보기로 점진 표시하도록 변경했다.
- 2026-07-12: 관리자 사이드바 백업/복원/시트 동기화 도구를 첫 진입에서 바로 로드하지 않고 시스템 도구 클릭 시 lazy chunk로 로드하도록 변경했다.
- 2026-07-12: Vercel Fluid Compute와 `icn1` region 설정을 적용해 관리자 함수 cold start와 DB 거리 비용을 줄였다.
- 2026-07-12: `/admin` 대시보드 primary payload의 여러 DB 호출을 통합 SQL 호출로 줄였다.
- 2026-07-11: 관리자 대시보드와 원생 목록의 초기 렌더링을 가볍게 만들기 위해 대시보드는 요약 먼저, 원생 목록은 최초 50명만 표시하도록 변경했다.
- 2026-07-11: `/admin/programs`, `/admin/schedule`, `/admin/students`, `/admin/classes`, `/admin/trial` 등 주요 관리자 페이지가 서버 캐시 payload를 초기에 주입받도록 정리했다.
- 2026-07-11: 관리자 공통 shell의 반복 API와 권한 확인 비용을 줄이기 위해 trial-count 자동 조회 제거, `getClaims()` 우선 인증, role 메모리 캐시를 적용했다.
- 2026-07-11: Google Sheets 시간표를 수동 동기화 + DB 캐시 방식으로 전환해 페이지 진입 시 외부 시트를 기다리지 않도록 했다.

## 구현 기록
- 변경 파일: `src/app/admin/students/StudentManagementClient.tsx`, `src/app/admin/trial/TrialCrmClient.tsx`, `src/app/admin/apply/ApplyAdminClient.tsx`, `prisma/schema.prisma`, `prisma/sql/admin_performance_indexes.sql`, `package.json`
- 주요 변경:
  - 원생 목록의 자동 전체 재조회와 반복 정렬 계산을 제거.
  - 체험 CRM/수강 신청 목록을 최초 50건 렌더링 + 더 보기 방식으로 전환.
  - 수납/알림/피드백/체험/대기/보강/등록 통계 조회에 맞는 인덱스를 추가.
  - Prisma 5에서 실패하던 `db:push` 스크립트 옵션을 제거.

## 테스트 결과
- `npx.cmd tsc --noEmit`: 통과
- `npx.cmd prisma validate`: 통과
- `npm.cmd run build`: 통과 (로컬 Supabase 접속 경고는 fallback으로 흡수, exit 0)

## 다음에 할 것
- 사용자 명시 승인 후 운영 DB에 인덱스를 적용한다. (`npm.cmd run db:push` 또는 Supabase SQL Editor에서 `prisma/sql/admin_performance_indexes.sql`)
