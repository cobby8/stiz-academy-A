# STIZ Codex Scratchpad

## 현재 작업
- 작업명: 체험신청 테이블 폭 축소 및 퀵액션 메뉴 잘림 수정
- 상태: 구현 및 검증 완료, 커밋 준비
- 기준일: 2026-07-22

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 테이블 폭 | 완료 | PC에서는 부모 폭에 맞추고 모바일에서만 최소 폭으로 가로 스크롤 유지 |
| 컬럼 여백 | 완료 | 수업/이름/학교/학년 셀 패딩과 컬럼 비율을 줄여 빈 공간 축소 |
| 번개 액션 | 완료 | 스크롤 박스에 잘리지 않도록 화면 기준 fixed 플로팅 메뉴로 전환 |
| 검증 | 완료 | TypeScript, ESLint, 신청 관리 UX 테스트 통과 |

## 구현 기록
- `src/app/admin/trial/TrialCrmClient.tsx`: 체험신청 테이블 최소 폭과 컬럼 비율을 줄이고 번개 메뉴를 fixed 플로팅으로 변경.
- `tests/application-management-ux.test.mjs`: 축소된 테이블 폭과 fixed 퀵액션 메뉴 회귀 테스트 갱신.

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
- `git diff --check`: 통과

## 작업 로그
- 2026-07-22: 체험신청 테이블의 PC 강제 가로폭을 줄이고 번개 퀵액션 메뉴가 스크롤 박스에 잘리지 않도록 fixed 플로팅으로 변경했다.
- 2026-07-22: 체험신청 목록을 상태/날짜/수업/학생정보/상태변경/번개액션 구조로 재정렬하고 쌤알림을 액션 메뉴 안으로 이동했다.
- 2026-07-22: 체험신청 목록에서 신청일/체험일을 상태 왼쪽으로 보내고 체험일 오름차순 정렬과 날짜 필터를 추가했다.
- 2026-07-22: 체험신청 목록에서 신청일/체험일을 날짜만 표시하고 쌤알림을 별도 컬럼의 발송/완료/재발송 버튼으로 분리했다.
- 2026-07-22: 체험/수강신청 목록에서 보호자 컬럼을 제거하고 액션을 단일 플로팅 메뉴로 묶어 행을 진짜 한 줄 높이로 줄였다.
- 2026-07-22: 셔틀 확정 노선에 운행 완료 상태를 추가하고, 관리자 화면에서 기사 앱 체크 현황을 30초마다 자동 갱신하도록 개선했다.
- 2026-07-22: 체험/수강신청 카드형 UI를 폐기하고 한 줄 목록 + 행 클릭 상세 모달 + 우측 퀵액션 구조로 단순화했다.
- 2026-07-22: 수강신청 카드형 화면의 큰 정보 타일과 버튼을 콤팩트 칩/버튼으로 줄여 한 화면에 더 많은 신청을 볼 수 있게 했다.
- 2026-07-21: 셔틀 기사 앱에 승객별 탑승/하차/미탑승 즉시 체크를 추가하고 관리자 노선 화면에 운행 상태 배지를 표시했다.
- 2026-07-21: 셔틀 노선에 담당 기사 배정을 추가하고 관리자 노선 확정 조건과 기사 모바일 운행표 조회를 연결했다.

## PM 체크
- scratchpad 작업 로그 10건 이내 유지.
- scratchpad 100줄 이내 유지.
- 에러 발생 없음.
- 임시 파일과 개인 설정 파일은 커밋하지 않음.
