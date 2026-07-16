# STIZ Codex Scratchpad

## 작업 로그
- 2026-07-16: 관리자 수납/결제 화면에 청구서 발행 콘솔과 발행 전 전체 검수표를 추가했다.
- 2026-07-16: 관리자 신청/체험 목록을 서버 페이지 단위 로딩으로 전환하고 `/admin/apply` 첫 진입 payload를 축소했다.
- 2026-07-16: 체험/수강신청 관리자에 상담, 부재, 재연락 기록 기능을 추가하고 최신 연락 요약만 목록에 붙였다.
- 2026-07-16: 교사용 수업 종료 메모 자동 저장, 사진/청구 역할 복구, 연락 동의, 로딩/오류 화면을 개선했다.
- 2026-07-16: 체험 문의/수강신청 목록에 전화, 연락처 복사, 상담문 복사 액션을 추가했다.
- 2026-07-16: 교사용 공식 진입점, 개인 초대 링크, PWA 설치, SMS 실패 시 링크 복사 흐름을 보강했다.
- 2026-07-15: 학생 등록 데이터를 최신 7월 기준으로 정리하고 월별 수강 상태를 개인 히스토리와 현재 상태로 분리했다.
- 2026-07-15: 관리자 수납/결제에 청구서, Toss 온라인 결제 기록, 미납 확인, 현장 결제 반영 흐름을 추가했다.
- 2026-07-14: 체험 CRM과 수강신청 관리를 `/admin/apply` 통합 탭으로 정리했다.

## 현재 작업
- 작업명: 청구서 발행 기능 강화
- 상태: 구현 및 검증 완료, 커밋 대기
- 범위: 청구 미리보기 전체 검수 데이터, 단계형 발행 콘솔, 성공 메시지 표시
- 기준일: 2026-07-16

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 서버 미리보기 | 완료 | 전체 검수 행에 학생, 수업, 학부모, 기존 청구 상태 포함 |
| 발행 콘솔 | 완료 | 대상 확인, 검수 후 발행, 링크 발송, 미납 관리를 단계형으로 표시 |
| 검수표 | 완료 | 발행 전 전체 항목과 연락처/기존 청구 확인 사유 표시 |
| 성공 메시지 | 완료 | 청구 확인/발행/발송 결과를 화면 안에 유지 |
| 검증 | 완료 | `tsc --noEmit`, UI 파일 lint, `git diff --check` 통과 |

## 구현 기록
- `src/app/actions/admin.ts`: `previewMonthlyInvoices`가 샘플 20건과 전체 검수 행을 함께 반환하도록 확장.
- `src/app/admin/finance/FinanceClient.tsx`: 월 선택 아래 청구서 발행 콘솔, 검수 요약, 전체 검수표를 추가.

## 테스트 결과
- `cmd /c node_modules\.bin\tsc.cmd --noEmit`: 통과
- `cmd /c npm run lint -- src/app/admin/finance/FinanceClient.tsx`: 통과
- `git diff --check -- src/app/actions/admin.ts src/app/admin/finance/FinanceClient.tsx`: 통과
- `cmd /c npm run lint -- src/app/admin/finance/FinanceClient.tsx src/app/actions/admin.ts`: 기존 `admin.ts`의 `any` 규칙 위반 다수로 실패

## PM 체크
- 작업 로그 최근 10건 이내 유지.
- scratchpad 100줄 이내 유지.
- 이번 커밋에는 청구 기능 변경 파일과 scratchpad만 포함 예정.
