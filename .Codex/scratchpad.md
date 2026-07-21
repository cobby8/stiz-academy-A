# STIZ Codex Scratchpad

## 현재 작업
- 작업명: 신청 관리 유입경로 통계 탭 구현
- 상태: 구현 및 검증 완료, 커밋 준비
- 기준일: 2026-07-22

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 집계 API | 완료 | 체험/수강신청 유입경로를 기간별로 DB 전체 집계 |
| 관리자 UI | 완료 | 신청 관리 안에 유입 통계 탭과 지표 카드/테이블 추가 |
| 속도 유지 | 완료 | 탭 진입 시에만 통계를 지연 로딩하고 60초 캐시 적용 |
| 검증 | 완료 | TypeScript, ESLint, 신청 관리 UX 테스트 통과 |

## 구현 기록
- `src/lib/adminReadPayloads.ts`: 유입경로별 체험/수강신청/전환 통계 집계 payload 추가.
- `src/app/api/admin/apply/source-stats/route.ts`: 관리자 전용 유입경로 통계 API 추가.
- `src/app/admin/apply/ApplyAdminClient.tsx`: 신청 관리에 유입 통계 탭, 기간 필터, 지표 카드, 경로별 테이블 추가.
- `tests/application-management-ux.test.mjs`: 유입 통계 탭과 지연 로딩 API 회귀 테스트 추가.

## 테스트 결과
- 1차 `npx tsc --noEmit`: 통과
- 1차 `node --test tests\application-management-ux.test.mjs`: 10개 통과
- 1차 `npx eslint src\app\admin\trial\TrialCrmClient.tsx tests\application-management-ux.test.mjs`: 통과
- 최종 `npx tsc --noEmit`: 통과
- 최종 `node --test tests\application-management-ux.test.mjs`: 10개 통과
- 최종 `npx eslint src\app\admin\trial\TrialCrmClient.tsx tests\application-management-ux.test.mjs`: 통과
- 추가 `npx tsc --noEmit`: 통과
- 추가 `node --test tests\application-management-ux.test.mjs`: 10개 통과
- 추가 `npx eslint src\app\admin\trial\TrialCrmClient.tsx tests\application-management-ux.test.mjs`: 통과
- 중복 제거 후 `npx tsc --noEmit`: 통과
- 중복 제거 후 `node --test tests\application-management-ux.test.mjs`: 10개 통과
- 중복 제거 후 `npx eslint src\app\admin\trial\TrialCrmClient.tsx tests\application-management-ux.test.mjs`: 통과
- 유입 통계 후 `npx tsc --noEmit`: 통과
- 유입 통계 후 `node --test tests\application-management-ux.test.mjs`: 11개 통과
- 유입 통계 후 `npx eslint src\app\admin\apply\ApplyAdminClient.tsx src\app\api\admin\apply\source-stats\route.ts src\lib\adminReadPayloads.ts tests\application-management-ux.test.mjs`: 통과
- `git diff --check`: 통과

## 작업 로그
- 2026-07-22: 신청 관리 안에 유입 통계 탭을 추가하고 체험/수강신청 유입경로를 기간별로 지연 로딩해 확인하도록 구현했다.
- 2026-07-22: 체험신청 상태변경 컬럼의 수강신청 안내 중복 버튼을 제거하고 유입경로 통계는 신청 관리 안의 유입 통계 탭으로 기획했다.
- 2026-07-22: 체험신청 테이블의 PC 강제 가로폭을 줄이고 번개 퀵액션 메뉴가 스크롤 박스에 잘리지 않도록 fixed 플로팅으로 변경했다.
- 2026-07-22: 체험신청 목록을 상태/날짜/수업/학생정보/상태변경/번개액션 구조로 재정렬하고 쌤알림을 액션 메뉴 안으로 이동했다.
- 2026-07-22: 체험신청 목록에서 신청일/체험일을 상태 왼쪽으로 보내고 체험일 오름차순 정렬과 날짜 필터를 추가했다.
- 2026-07-22: 체험신청 목록에서 신청일/체험일을 날짜만 표시하고 쌤알림을 별도 컬럼의 발송/완료/재발송 버튼으로 분리했다.
- 2026-07-22: 체험/수강신청 목록에서 보호자 컬럼을 제거하고 액션을 단일 플로팅 메뉴로 묶어 행을 진짜 한 줄 높이로 줄였다.
- 2026-07-22: 셔틀 확정 노선에 운행 완료 상태를 추가하고, 관리자 화면에서 기사 앱 체크 현황을 30초마다 자동 갱신하도록 개선했다.
- 2026-07-22: 체험/수강신청 카드형 UI를 폐기하고 한 줄 목록 + 행 클릭 상세 모달 + 우측 퀵액션 구조로 단순화했다.
- 2026-07-22: 수강신청 카드형 화면의 큰 정보 타일과 버튼을 콤팩트 칩/버튼으로 줄여 한 화면에 더 많은 신청을 볼 수 있게 했다.

## PM 체크
- scratchpad 작업 로그 10건 이내 유지.
- scratchpad 100줄 이내 유지.
- 에러 발생 없음.
- 임시 파일과 개인 설정 파일은 커밋하지 않음.
