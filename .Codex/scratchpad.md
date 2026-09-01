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
| Solapi 일괄 전송 | developer + tester + reviewer | 완료 | send-many 1회 접수·부분 실패·10분 유예·최종 결과 재조회 검증 |
| 유니폼 본사 연동 | developer + tester | 완료(발송 대기) | 자체 폼·DB 원장·디자인/이니셜·HMAC 전송·관리자 상태 화면·운영 DB 프리플라이트·로컬 빌드 검증 |

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

- 유니폼 주문 보강: `node --test tests\uniform-partner.test.mjs tests\uniform-order-db-preflight.test.mjs tests\uniform-orders.test.mjs`, `npx.cmd tsc --noEmit`, `npm run release:code-check`, `npm run build` 통과. 운영 DB 컬럼과 최근 2건 디자인/이니셜 보강 완료. 본사 주문 전송·SMS 발송·배포 호출 없음.
- Solapi 묶음 발송 최종 재QA: 타깃 20건과 문자·장부 확대 회귀 129건, `npx.cmd tsc --noEmit`, `git diff --check` 모두 통과했다.
- `send-many/detail` 단일 접수·500명 상한·`customFields.deliveryId` 매칭, 4xx 실패/5xx·누락·timeout 불확실 분리, `groupInfo.groupId`·객체형 목록/customFields 호환, Bizppurio 순차 호환, `ACCEPTED`와 최종 `SENT` 분리, stale sweep의 ACCEPTED 제외, 결과 누락 10분 유예·그룹 5개 제한·페이지네이션·최종 집계·providerStatus 노출을 확인했다.
- 테스트는 실제 Solapi·Bizppurio·운영 DB를 호출하지 않았다. 신규 공급자 테스트는 소스 계약 검사 중심이므로 실제 응답 fixture 기반 분기 행동과 DB 상태 전이·페이지네이션 통합 검증은 후속 보강 권장이다.
- 기존 대량 SMS 큐의 500명 상한·멱등·암호화·UNCERTAIN 격리 회귀는 유지한다.

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

- 최종 판정: 통과. 이전 필수 수정 2건과 크론 시간·UI 상태 문제가 반영되었으며 추가 차단 결함은 발견하지 못했다.
- 확인 내용: Solapi 4xx만 FAILED, 5xx·타임아웃은 UNCERTAIN; `groupInfo.groupId` 우선; 배열·객체 messageList와 문자열 customFields 지원; 결과 누락 10분 유예; 그룹 5개/회; ACCEPTED stale 재전송 차단; recipient providerStatus 노출; Bizppurio 단건 호환 유지.
- 검증: 관련 테스트 20건, `tsc --noEmit`, `git diff --check` 통과. 실제 Solapi·운영 DB 호출 없음.
- 남은 권장사항: 현재 공급자 테스트는 정규식 계약 중심이므로 추후 fetch mock 기반 부분 성공·5xx·결과 지연 행동 테스트를 추가한다.
| tester | `tests/manual-message-bulk-queue.test.mjs` | 실제 DB 행동 테스트가 없어 동시 claim·requestId 경합·stale 격리를 정규식으로만 검사함. 가짜 DB 또는 테스트 DB 행동 검증 보강 필요 | 대기 |
| tester | `tests/sms-business-delivery-reliability.test.mjs` | 수강승인 이벤트 ID 기대식 불일치. 변경 전 HEAD에도 동일하며 이번 대량 큐와 무관한 선행 실패로 분리 | 별도 대기 |
| reviewer | `src/app/api/cron/manual-message-reconcile/route.ts:21-27` | Solapi 결과 누락은 10분 동안 ACCEPTED 상태로 재조회하고 유예 뒤에만 UNCERTAIN 격리하도록 보완됨 | 완료 |
| reviewer | `src/lib/sms.ts:370-386` | HTTP 4xx만 FAILED, 5xx는 UNCERTAIN으로 분리해 중복 재발송 위험을 차단함 | 완료 |

## 확인보류

- 성인반 복귀 1건: 시트·Rallyz·사이트의 상태와 금액 기준이 달라 등록과 청구를 분리하고 확인보류한다.
- 다음 월 개강일과 청구 기준일은 실행 시 공식 연간일정표에서 재확인한다.
- RESUME/CLASS_ADD/CLASS_CHANGE 자동 실행 어댑터는 다음 그룹이다.

## 작업 로그 (최근 10건)
- 2026-09-02: 유니폼 주문 항목에 디자인·이니셜 필드를 추가하고 신청 폼·관리자 화면·본사 payload·DB 검사·운영 DB 최근 2건을 보강했다. release:code-check 1,331건·빌드 통과, 본사 주문/SMS 발송 없음.
- 2026-09-01: 관리자 신규 원생 등록의 생년월일 입력을 모바일·자동 입력에 안정적인 YYYY-MM-DD 숫자 입력 방식으로 수정했다. `tsc --noEmit` 통과, 운영 DB·배포·외부 발송 없음.
- 2026-09-01: 필수 보완까지 반영된 Solapi `send-many/detail` 대량 발송을 외부 호출 없이 최종 재QA했다. 타깃 20건·문자/장부 회귀 129건·tsc·diff-check 통과, 차단 결함과 실제 Solapi·DB·문자 발송 없음.
- 2026-08-31: 운영 동기화 PENDING 항목을 시트·랠리즈·홈페이지 순서로 읽기 전용 분류하는 워커와 인증 크론 라우트를 추가했다. 관련 40건·eslint·tsc 통과, Vercel cron 미등록, 운영 DB·시트·랠리즈 쓰기 없음.
- 2026-08-31: 유니폼 자체 신청 폼·DB 주문 원장·STIZ 본사 HMAC 전송·관리자 상태 화면과 Vercel/릴리스 DB 프리플라이트를 구현했다. release:code-check 1,319건·타깃 60건·빌드 검증, 운영 DB·외부 주문·문자·배포 없음.
- 2026-08-31: 대량 SMS 큐 최종 재QA에서 poison 격리·payload 삭제·5건 제한·격리 배치 재집계를 확인했다. 관련 63건 통과, 선행 실패 1건 분리, tsc·diff-check 통과, 실제 DB·문자·배포 없음.
- 2026-08-31: 유니폼 신청서를 신규·입금확인·발주완료·학원도착·과거자료로 나누고 학생 원장과 대조하는 관리자 화면을 구현했다. 회귀 3건·tsc·diff 검사 통과, 시트·주문·문자·배포 없음.
- 2026-08-31: 카카오 학부모 최초 1회 인증, HMAC 사용자 식별, 15분 연결 링크, 21종 자연어 분류, 접수 전 확인, 관리자 카카오 접수함을 구현했다. 회귀 3건·tsc·Prisma·diff 검사 통과, DB·배포·외부 발송 없음.
- 2026-08-30: 신규 학생 최초 등록의 완료 범위를 3중 수강 등록·최초 청구/알림·Rallyz 학부모 초대·재조회로 확정하고, 월 중간 시작 일할계산과 실행 직전 승인 경계를 공용 스킬에 기록했다.
- 2026-08-30: 신청관리의 체험수업·수강신청 목록을 접수일 최신순으로 통일하고 동일 시각 순서를 고정했다. 관련 17건·독립 QA·tsc·diff 검사 통과, 배포 없음.

## PM 체크

- scratchpad 100줄 이내 및 작업 로그 최근 10건 유지.
- 오류·기술결정·구조·관례는 knowledge 파일에 반영.
- 운영 DB 변경·외부 발송·배포는 별도 승인.
- 미추적 `_codex_locked_old/`는 작업 범위 밖이므로 건드리지 않는다.
