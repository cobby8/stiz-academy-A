# STIZ Codex Scratchpad

## 현재 작업
- 작업명: 체험 신청 일정 정보 가독성 및 수업 시간 연결 개선
- 상태: 구현 및 검증 완료, 커밋 준비
- 기준일: 2026-07-21

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 일정 정보 UI | 완료 | 신청일, 희망일자, 수업교시, 확정일정을 큰 정보 블록으로 분리 |
| 수업 DB 연결 | 완료 | 체험 신청 payload에 Class 목록을 포함하고 slotKey/id 기반 표시 적용 |
| 일정 저장 모달 | 완료 | 날짜/시간/확정 수업을 분리해 잘못된 기본 09:00 저장 위험 완화 |
| 검증 | 완료 | TypeScript, 신청 UX 테스트, 모달 접근성 테스트, diff check 통과 |

## 구현 기록
- `src/lib/adminReadPayloads.ts`: 체험 신청 payload에 `classes`를 포함하고 `admin-classes` 캐시 태그를 연결.
- `src/app/admin/apply/page.tsx`: 체험 신청 초기 수업 목록을 신청 관리 클라이언트로 전달.
- `src/app/admin/apply/ApplyAdminClient.tsx`: `initialTrialClasses`를 받아 체험 CRM 클라이언트에 전달.
- `src/app/admin/trial/TrialCrmClient.tsx`: ClassInfo 타입, 수업 라벨 포맷, 신청/희망/교시/확정 일정 정보 블록, 목록형/카드형 표시 개선.
- `src/app/admin/trial/TrialCrmModals.tsx`: 일정 변경 모달에 확정 수업 선택, 날짜 입력, 시간 입력을 분리하고 수업 시작 시간 자동 입력 적용.
- `tests/application-management-ux.test.mjs`: 일정 정보 라벨과 DB 수업 연결 회귀 테스트 추가.

## 테스트 결과
- `npx tsc --noEmit`: 통과
- `node --test tests\application-management-ux.test.mjs tests\admin-modal-accessibility.test.mjs`: 통과
- `git diff --check`: 통과

## 작업 로그
- 2026-07-21: 체험 신청 목록/카드에서 신청일, 희망일자, 수업교시, 확정일정을 크게 분리하고 DB 수업 시간 연결을 적용했다.
- 2026-07-21: 체험수업과 수강신청의 카드형/목록형 보기를 추가하고 목록형에서 필수 정보와 상태 처리를 빠르게 보이게 했다.
- 2026-07-21: 관리자 신청 관리 메뉴와 카드 액션을 단순화해 모바일에서 버튼과 배지가 세로로 깨지는 문제를 정리했다.
- 2026-07-21: 체험/수강신청 수정, 일정, 취소 이력을 운영 기록으로 남기고 상세 모달의 다음 행동 동선을 보강했다.
- 2026-07-21: 체험 신청 문자 상태와 재발송 흐름을 관리자 화면에서 확인할 수 있게 보강했다.

## PM 체크
- scratchpad 작업 로그 10건 이내 유지.
- scratchpad 100줄 이내 유지.
- 에러 발생 없음.
- 임시 파일과 개인 설정 파일은 커밋하지 않음.
