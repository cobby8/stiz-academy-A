# STIZ Codex Scratchpad

> 2026-07-16 작업 로그: 마이페이지를 DB 학부모 권한으로 보호하고 공개 홈페이지 계정 버튼을 DB 역할과 연동했으며 로그인 딥링크 검색조건을 안전하게 보존했다.

## 계정별 진입점 최종 보완
- 상태: 구현 완료, 최종 재검증 중
- 마이페이지: PARENT만 허용, 다른 역할은 각 업무 홈으로 복귀
- 공개 홈페이지: 인증 ID 우선 DB 역할로 계정 버튼 결정
- 딥링크: 보호 경로의 query string까지 로그인 후 복원

> 2026-07-16 작업 로그: 역할별 로그인 기본 홈을 DB 권한 기준으로 통일하고, 교사용 앱에 홈페이지 왕복 메뉴와 수업 중 저장 완료 후 이탈 보호를 추가했다.

## 홈페이지·업무 앱 왕복
- 상태: 구현 완료, 최종 재검증 중
- 로그인: 관리자 `/admin`, 교사 `/staff`, 학부모 `/mypage`, 허용 딥링크 우선
- 교사 메뉴: 홈페이지·공지·프로그램·시간표·갤러리·설치·로그아웃
- 수업 보호: 실제 메모 저장 완료 후 이동, 실패·음성 처리 중 이동 차단

## 작업 로그
- 2026-07-16: 최신 수강생 시트를 다시 가져와 7월 수강/수납 상태를 반영하고, 이월 청구를 미납이 아닌 취소/이월로 닫는 규칙을 추가했다.
- 2026-07-16: 관리자 청구 콘솔에 이번 달 자동 생성/정리와 발행 전 검수 필터를 추가하고 임시 학부모 테스트 데이터 정리를 준비했다.
- 2026-07-16: 학부모 마이페이지 미납 카드와 청구서 상세 화면을 개선하고 임시 계정으로 납부 흐름을 대조했다.
- 2026-07-16: 관리자 수납/결제 화면에 청구서 발행 콘솔과 발행 전 전체 검수표를 추가했다.
- 2026-07-16: 관리자 신청/체험 목록을 서버 페이지 단위 로딩으로 전환하고 `/admin/apply` 첫 진입 payload를 축소했다.
- 2026-07-16: 체험/수강신청 관리자에 상담, 부재, 재연락 기록 기능을 추가하고 최신 연락 요약만 목록에 붙였다.
- 2026-07-16: 교사용 수업 종료 메모 자동 저장, 사진/청구 역할 복구, 연락 동의, 로딩/오류 화면을 개선했다.
- 2026-07-16: 체험 문의/수강신청 목록에 전화, 연락처 복사, 상담문 복사 액션을 추가했다.
- 2026-07-16: 교사용 공식 진입점, 개인 초대 링크, PWA 설치, SMS 실패 시 링크 복사 흐름을 보강했다.
- 2026-07-15: 학생 등록 데이터를 최신 7월 기준으로 정리하고 월별 수강 상태를 개인 히스토리와 현재 상태로 분리했다.

## 현재 작업
- 작업명: 최신 시트 수강/수납 상태 재동기화
- 상태: 구현 및 검증 완료, 커밋 대기
- 범위: 시트 결제수단 해석, 이월 청구 취소 처리, 2026년 7월 수강/수납 DB 반영
- 기준일: 2026-07-16

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 시트 장부 저장 | 완료 | 등록 210행, 파싱 오류 0건, 미연결 0건 |
| 수강 상태 반영 | 완료 | 최종 대조 기준 생성/재활성/휴원 추가 변경 0건 |
| 수납 상태 반영 | 완료 | 랠리즈/카드/현금영수증 납부, 미납/미결제 미납, 이월 취소/이월 처리 |
| 검증 | 완료 | 타입검사, 대상 파일 lint 오류 없음, 최종 동기화 생성/수정 0건 |

## 구현 기록
- `src/lib/importStudents.ts`: `미납` 표기를 미납 결제수단으로 인식.
- `src/app/api/admin/finance/sheet-reconcile/route.ts`: `미납/미결제`, `이월`, `추가수강`, `휴원/퇴원` 수납 대조 규칙 보정.
- `src/lib/payment-ledger.ts`, `src/app/actions/admin.ts`: `CANCELED` 결제 상태를 청구서 취소 상태와 연결.
- `src/app/admin/finance/FinanceClient.tsx`, `src/app/admin/students/[id]/StudentDetailClient.tsx`, `src/app/mypage/MyPageClient.tsx`: 취소/이월 라벨 표시.
- `.tmp/sync-student-sheet-and-finance.js`: 커밋 제외 임시 스크립트로 최신 시트 동기화와 DB 대조 실행.

## 테스트 결과
- `cmd /c node_modules\.bin\tsc.cmd --noEmit`: 통과
- `cmd /c npm run lint -- src/lib/importStudents.ts src/app/api/admin/finance/sheet-reconcile/route.ts src/lib/payment-ledger.ts src/app/admin/finance/FinanceClient.tsx src/app/mypage/MyPageClient.tsx src/app/admin/students/[id]/StudentDetailClient.tsx`: 오류 없음, 기존 `<img>` 경고 2건
- `node --check .tmp\sync-student-sheet-and-finance.js`: 통과
- `node .tmp\sync-student-sheet-and-finance.js`: 최종 통과, 수강 생성/수정 0건, 수납 생성/수정 0건

## PM 체크
- 작업 로그 최근 10건 이내 유지.
- scratchpad 100줄 이내 유지.
- 임시 동기화 스크립트는 커밋하지 않음.
