# STIZ 작업 스크래치패드

## 현재 작업

- 목표: 운영 동기화 원장의 PENDING 항목을 안전하게 분류하고 후속 반영 준비 상태를 확인한다.
- 현재 단계: 읽기 전용 운영 동기화 워커와 인증 크론 라우트 구현 및 로컬 검증 완료. 실제 시트·Rallyz·홈페이지 자동 쓰기는 별도 승인과 실행 모드 설계 필요.
- 운영 반영: 운영 DB 변경, 시트 변경, 주문, 문자, 배포 없음.
- 별도 실행 대기: 수강 상태 변경 1건의 3중 반영, 중복 청구 후보 정리, 정확한 미납 안내 승인.

## 진행 현황표

| 그룹 | 담당 | 상태 | 완료 기준 |
|---|---|---|---|
| 실시간 동기화 설계 | planner-architect | 완료 | 기존 Operations 원장 재사용과 단계별 구조 확정 |
| 사이트 변경 원장 | developer | 완료 | Enrollment 변경과 원장 적재 동일 트랜잭션 |
| 외부 이벤트 접수 | developer | 완료 | HMAC·재생 방지·멱등·충돌 차단 |
| 안전 검증 | tester + reviewer | 완료 | 통합 회귀 41건, tsc, diff-check 통과 |
| 원장 소비 워커 | developer + tester | 부분 완료 | PENDING 후보 읽기 전용 분류·인증 크론 라우트·계약 테스트 통과, 외부 자동 쓰기 미등록 |
| 성인반 복귀 1건 | PM | 확인보류 | 세 시스템 금액 기준 확정 후 새 미리보기 |
| 신규 수강 안전 승인 | developer + tester + reviewer | 완료 | 알림 미발송·원장 원자성·멱등성·정적 검사 통과 |
| 신규 수강신청 1건 | PM | 승인 대기 | 3중 등록 재조회 후 청구·알림·초대는 미리보기 승인 전 HELD, 승인 후 재조회 완료 |
| 대량 SMS 큐 | developer + tester + reviewer | 완료 | 최대 500명 접수·멱등·비동기 처리·진행률·UNCERTAIN 격리 검증 |
| 유니폼 본사 연동 | developer + tester | 완료 | 자체 폼·DB 원장·HMAC 전송·관리자 상태 화면·Vercel DB 프리플라이트·로컬 빌드 검증 |

## 구현 기록

- 정규 셔틀 관리자 UI: 한국시간 기본월, 가장 가까운 이전 월 비교, 모바일 순서 이동, 접근성 문자 모달을 적용했다.
- 정규 셔틀 문자: 미리보기 payload를 `HELD → APPROVED → SENT`로 분리하고, 내용 변경 시 기존 승인을 취소하며 동일 payload 중복 발송을 막았다.
- 관련 파일: `RegularShuttleClient.tsx`, `RegularRouteSection.tsx`, `regular-notice/route.ts`, `regular-shuttle-admin-ui.test.mjs`.
- 검증: 정규 셔틀 회귀 7건, `tsc --noEmit`, `git diff --check` 통과. 운영 DB·외부 문자·배포 호출 없음.
- `src/lib/operations-events/`: 공용 이벤트 정규화, 날짜·월·payload 검증, 의미 기반 지문, 멱등 원장 적재.
- `src/app/api/operations-events/`: 64KB 제한, HMAC-SHA256, 5분 재생 방지, source+eventId 중복·충돌 처리.
- `src/app/actions/admin.ts`: enrollStudent/updateEnrollmentStatus와 원장 적재를 동일 트랜잭션으로 연결.
- `src/app/admin/students/[id]/StudentDetailClient.tsx`: 하드 삭제 UI 제거, WITHDRAWN 이력 보존 경로만 유지.
- PAUSE/WITHDRAW는 기존 시트 계약과 호환한다. RESUME/CLASS_ADD/CLASS_CHANGE 및 셔틀·연락처·청구는 전용 어댑터 전까지 HELD.
- WEBSITE는 SUCCEEDED, SHEET·RALLYZ는 PENDING, billing·notification은 HELD로 시작한다.
- 동일 상태 재저장은 Enrollment와 updatedAt 모두 변경하지 않는다.

## 기획설계

- 사이트 변경은 원본 시스템 완료, 나머지 시스템 대기로 기록한다.
- 시트 직접 변경은 서명된 이벤트로 사이트 승인대기 원장에 접수한다.
- Rallyz 공식 API·웹훅이 없으므로 로그인 브라우저 감독형 반영을 유지한다.
- 다음 단계는 시트 Apps Script 발신 코드, PENDING 소비 워커, 관리자 상태 화면이다.
- 오전 10시 전체 대조는 실시간 경로의 누락 안전망으로 유지한다.
- 청구·결제·환불·문자·알림은 정확한 미리보기와 실행 시점 승인 전 자동 실행하지 않는다.

## 테스트 결과

- 대량 SMS 큐 재QA: 관련 핵심/회귀 64건 중 63건 통과, 1건은 변경 전 HEAD에도 동일한 선행 실패. 신규 큐 5건·`tsc --noEmit`·`git diff --check`는 통과했다.
- 500명 상한, 기존 `sendManualSms` 100명 호환, 관리자 인증, requestId 멱등, 암호화 payload/마스킹 응답, `FOR UPDATE SKIP LOCKED`, stale `SENDING → UNCERTAIN`, 2.5초 UI polling 계약을 확인했다.
- poison row 개별 UNCERTAIN 격리, stale/복호화 실패 payload 삭제, cron 실행당 5건 제한, 세 경로의 `finalizeBatchIds` 집계 보완을 확인했다. 실제 DB·Solapi를 사용하지 않아 동시 claim과 stale 전환은 SQL 정적 계약까지만 검증했다.
- 확대 회귀의 `sms-business-delivery-reliability.test.mjs` 1건은 변경 전 HEAD에도 기대 eventId가 없고 테스트 파일도 변경되지 않아 대량 큐와 무관한 선행 실패로 분리했다.

- 이전 체험 일정·셔틀 위치 링크 회귀와 TypeScript/Prisma 검증은 완료 상태를 유지한다.

## 수정 요청

| 요청자 | 파일 | 문제 | 상태 |
|---|---|---|---|
| tester | 체험 일정/문자 경로 | Sat-2 canonical 시간, date-only 차단, stale Class 우선순위, 부모·담당자 동일 시간 보완 및 검증 완료 | 완료 |
| tester | `tests/regular-shuttle-location-link.test.mjs` | Prisma 가짜 어댑터 기반 roundtrip·경합·멱등 행동 테스트 보완 완료 | 완료 |
| reviewer | `src/lib/message-ledger.ts:101-125` | 암호문/키 오류 행을 UNCERTAIN 격리하고 나머지를 계속 처리하도록 보완됨 | 완료 |
| reviewer | `src/lib/message-ledger.ts:103-105,119` | stale·복호화 실패 UNCERTAIN 전환 때 payloadJSON을 즉시 제거하도록 보완됨 | 완료 |
| reviewer | `src/app/api/cron/manual-message-dispatch/route.ts:6-45` | 실행당 5건으로 축소해 공급자 최대 대기시간을 약 25초로 제한함 | 완료 |
| reviewer | `src/lib/message-ledger.ts:103-127`, `src/app/api/cron/manual-message-dispatch/route.ts:14-43` | stale·복호화 실패·정상 claim의 batchId를 모두 finalize 대상으로 전달해 배치 집계 정합성 보완 | 완료 |
| reviewer | `tests/manual-message-bulk-queue.test.mjs` | 보강 후에도 문자열 존재 검사만 있어 실제 동시 claim, 동일 requestId 경합, stale/복호화 실패, cron 중단 후 중복 없음이 검증되지 않음. DB 행동 테스트 필요 | 요청 |

### 리뷰 결과 (reviewer)

- 최종 판정: 통과. 멱등·동시 선점·UNCERTAIN 격리·암호 payload 삭제·배치 집계·cron 인증의 차단 결함은 없다.
- 권장 보강: 실제 DB 동시성·멱등·중단 복구 행동 테스트를 추가한다.
| tester | `tests/manual-message-bulk-queue.test.mjs` | 실제 DB 행동 테스트가 없어 동시 claim·requestId 경합·stale 격리를 정규식으로만 검사함. 가짜 DB 또는 테스트 DB 행동 검증 보강 필요 | 대기 |
| tester | `tests/sms-business-delivery-reliability.test.mjs` | 수강승인 이벤트 ID 기대식 불일치. 변경 전 HEAD에도 동일하며 이번 대량 큐와 무관한 선행 실패로 분리 | 별도 대기 |

## 확인보류

- 성인반 복귀 1건: 시트·Rallyz·사이트의 상태와 금액 기준이 달라 등록과 청구를 분리하고 확인보류한다.
- 다음 월 개강일과 청구 기준일은 실행 시 공식 연간일정표에서 재확인한다.
- RESUME/CLASS_ADD/CLASS_CHANGE 자동 실행 어댑터는 다음 그룹이다.

## 작업 로그 (최근 10건)
- 2026-08-31: 운영 동기화 PENDING 항목을 시트·랠리즈·홈페이지 순서로 읽기 전용 분류하는 워커와 인증 크론 라우트를 추가했다. 관련 40건·eslint·tsc 통과, Vercel cron 미등록, 운영 DB·시트·랠리즈 쓰기 없음.
- 2026-08-31: 유니폼 자체 신청 폼·DB 주문 원장·STIZ 본사 HMAC 전송·관리자 상태 화면과 Vercel/릴리스 DB 프리플라이트를 구현했다. release:code-check 1,319건·타깃 60건·빌드 검증, 운영 DB·외부 주문·문자·배포 없음.
- 2026-08-31: 대량 SMS 큐 최종 재QA에서 poison 격리·payload 삭제·5건 제한·격리 배치 재집계를 확인했다. 관련 63건 통과, 선행 실패 1건 분리, tsc·diff-check 통과, 실제 DB·문자·배포 없음.
- 2026-08-31: 유니폼 신청서를 신규·입금확인·발주완료·학원도착·과거자료로 나누고 학생 원장과 대조하는 관리자 화면을 구현했다. 회귀 3건·tsc·diff 검사 통과, 시트·주문·문자·배포 없음.
- 2026-08-31: 카카오 학부모 최초 1회 인증, HMAC 사용자 식별, 15분 연결 링크, 21종 자연어 분류, 접수 전 확인, 관리자 카카오 접수함을 구현했다. 회귀 3건·tsc·Prisma·diff 검사 통과, DB·배포·외부 발송 없음.
- 2026-08-30: 신규 학생 최초 등록의 완료 범위를 3중 수강 등록·최초 청구/알림·Rallyz 학부모 초대·재조회로 확정하고, 월 중간 시작 일할계산과 실행 직전 승인 경계를 공용 스킬에 기록했다.
- 2026-08-30: 신청관리의 체험수업·수강신청 목록을 접수일 최신순으로 통일하고 동일 시각 순서를 고정했다. 관련 17건·독립 QA·tsc·diff 검사 통과, 배포 없음.
- 2026-08-30: 수강 승인과 외부 알림을 분리하고 신규·복귀 수강 변경을 운영 원장에 같은 트랜잭션으로 적재했다. 관련 14건·독립 QA·tsc·Prisma·diff 검사 통과, 운영 DB·알림·배포 없음.
- 2026-08-29: Codex 공용 운영 인수인계 기반을 추가했다. AGENTS·저장소 스킬·PC 설정 런북·HANDOFF·구조 안전 테스트를 만들었고 운영 DB·예약·외부 발송·배포는 변경하지 않았다.
- 2026-08-28: 실사용성이 낮은 관리자 `3중 동기화` 화면과 메뉴를 폐기하고 기존 URL은 관리자 홈으로 이동했다. 학부모 링크 관리는 학생 상세로 옮기고 공개 요청·원장·출석·청구 백엔드는 보존했다. 운영 DB·푸시·배포 없음.
- 2026-08-28: 운영 동기화 관리자 화면의 간헐 오류를 진단해 SSR 런타임 DDL을 제거하고 7개 테이블·85개 컬럼·고유키·RLS·직접 권한을 읽기 전용으로 검사하도록 보강했다. 운영 DB·푸시·배포 없음.

## PM 체크

- scratchpad 100줄 이내 및 작업 로그 최근 10건 유지.
- 오류·기술결정·구조·관례는 knowledge 파일에 반영.
- 운영 DB 변경·외부 발송·배포는 별도 승인.
- 미추적 `_codex_locked_old/`는 작업 범위 밖이므로 건드리지 않는다.
