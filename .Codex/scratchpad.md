# STIZ Codex Scratchpad

## 현재 작업
- 작업명: 체험신청 목록 날짜/쌤알림 컬럼 분리 및 중복 정리
- 상태: 구현/DB 정리/검증 완료, 커밋 준비
- 기준일: 2026-07-22

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 날짜 컬럼 | 완료 | 체험신청 목록에서 신청일/체험일을 날짜만 표시하도록 분리 |
| 쌤알림 | 완료 | 쌤알림 전용 컬럼에 발송/완료/재발송 동작 연결 |
| 중복 정리 | 완료 | 신윤/신율의 과거 CANCELLED 체험신청 2건만 조건부 삭제 |
| 검증 | 완료 | TypeScript, ESLint, 신청 관리 UX 테스트, diff check 통과 |

## 구현 기록
- `src/app/admin/trial/TrialCrmClient.tsx`: 체험신청 목록을 신청일/체험일/수업교시/쌤알림/액션 컬럼으로 재구성.
- `tests/application-management-ux.test.mjs`: 체험신청 날짜 분리와 쌤알림 컬럼/버튼 회귀 테스트 갱신.
- DB: `TrialLead` 중 신윤/신율의 과거 `CANCELLED` 중복 신청 2건 삭제.

## 테스트 결과
- 1차 `npx tsc --noEmit`: 통과
- 1차 `node --test tests\application-management-ux.test.mjs`: 10개 통과
- 1차 `npx eslint src\app\admin\trial\TrialCrmClient.tsx tests\application-management-ux.test.mjs`: 통과
- 최종 `npx tsc --noEmit`: 통과
- 최종 `node --test tests\application-management-ux.test.mjs`: 10개 통과
- 최종 `npx eslint src\app\admin\trial\TrialCrmClient.tsx tests\application-management-ux.test.mjs`: 통과
- `git diff --check`: 통과

## 작업 로그
- 2026-07-22: 체험신청 목록에서 신청일/체험일을 날짜만 표시하고 쌤알림을 별도 컬럼의 발송/완료/재발송 버튼으로 분리했다.
- 2026-07-22: 체험/수강신청 목록에서 보호자 컬럼을 제거하고 액션을 단일 플로팅 메뉴로 묶어 행을 진짜 한 줄 높이로 줄였다.
- 2026-07-22: 셔틀 확정 노선에 운행 완료 상태를 추가하고, 관리자 화면에서 기사 앱 체크 현황을 30초마다 자동 갱신하도록 개선했다.
- 2026-07-22: 체험/수강신청 카드형 UI를 폐기하고 한 줄 목록 + 행 클릭 상세 모달 + 우측 퀵액션 구조로 단순화했다.
- 2026-07-22: 수강신청 카드형 화면의 큰 정보 타일과 버튼을 콤팩트 칩/버튼으로 줄여 한 화면에 더 많은 신청을 볼 수 있게 했다.
- 2026-07-21: 셔틀 기사 앱에 승객별 탑승/하차/미탑승 즉시 체크를 추가하고 관리자 노선 화면에 운행 상태 배지를 표시했다.
- 2026-07-21: 셔틀 노선에 담당 기사 배정을 추가하고 관리자 노선 확정 조건과 기사 모바일 운행표 조회를 연결했다.
- 2026-07-21: 체험신청의 수강생/보호자 연락처가 수강신청서에 자동 채워지도록 childPhone 전달과 보호자 연락처 fallback을 보강했다.
- 2026-07-21: 스태프 역할에 DRIVER를 추가하고 초대/가입/로그인 라우팅을 셔틀 기사 모바일 홈(`/staff/shuttle`)까지 연결했다.
- 2026-07-21: 관리자 헤더 알림 옆에 해/달 테마 토글을 배치하고 체험완료 후 수강신청 안내 버튼과 신청서 자동 채움 항목을 보강했다.

## PM 체크
- scratchpad 작업 로그 10건 이내 유지.
- scratchpad 100줄 이내 유지.
- 에러 발생 없음.
- 임시 파일과 개인 설정 파일은 커밋하지 않음.
