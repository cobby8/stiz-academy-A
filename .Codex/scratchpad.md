# STIZ 작업 스크래치패드
## 현재 작업
- 목표: 인증된 카카오 학부모 요청을 사이트에 접수하고 원장·담당 코치·기사에게 전달하며 승인형 외부 동기화로 연결한다.
- 현재 단계: 휴원·퇴원 삼중 성공/재조회 후 원 신청 appliedAt 확정 연결 구현. 관련 회귀 54건·TypeScript·QA 통과, 운영 DB 실행 및 배포 미검증.
- 운영 반영: 없음. 코드 변경과 테스트만 수행했다.
- 확인보류: 9월 차량표 시트 기준 사이트 누락/초과 행, 셔틀비 0원 일반탑승 후보, 화면 재확인 후 남는 셔틀 중복 후보, 랠리즈 대조.

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
| 토스 온라인 PG 자동결제 | developer + tester | 완료(키 설정 대기) | 학부모 결제창·서버 승인·웹훅·관리자 상태·프리플라이트 검증 |
| 본사 카페24 결제 브리지 | developer + tester | 완료(본사 API 인계 완료) | 결제 제공자 분기·서명 요청·서명 웹훅·관리자 표시·프리플라이트·빌드 검증, 본사 Issue #134 생성 |
| 카카오 학부모 접수 | developer + tester | 내부 자동화 완료·채널 배포 HELD | 최초 인증, 매분 라우팅, 원장·담당 코치·기사 내부 알림 검증; 외부 3중 쓰기는 승인형 |
| 정규 배차 담당 기사 알림 | developer + tester + reviewer | 완료·운영 배포 대기 | 월·요일·방향·학생 ID로 고유 기사 알림, 미배정/복수는 원장 확인, 요청 취소 포함 |
| 담당자 알림 전달 장부 | developer + tester + reviewer | 완료·운영 배포 대기 | 인앱·푸시 상태/오류/시도 기록, 중복 방지, 개인정보 제거, 5분 누락 복구, 관리자 조회 |

## 구현 기록
- 정규 셔틀 자동 제안은 요일 전체를 한 노선으로 합치지 않고 등원은 수업 시작, 하원은 수업 종료 시각별로 실행을 분리한다. 실행별 시간 앵커는 저장 JSON에 함께 보존한다.
- 정규 차량표 이관은 월 전체 삭제 후 재삽입하지 않고, 동일 정차 유지·신규 추가·빠진 정차 삭제·순서 업데이트만 수행한다. 장소명 표기가 달라도 주요 정류장 별칭은 같은 좌표로 승계한다.
- 정규 배차 화면은 등원/하원 분리보다 시간순 통합 타임라인을 먼저 보여주고, 방향별 세부 편집은 접힌 영역에서 유지한다.
- 기사님 통합 링크는 방학특강 시즌의 KST 시작일~종료일 안에서만 특강 배차를 붙인다. 시즌 종료 후에는 저장된 과거 특강 노선이 정규 기사 링크에 섞이면 안 된다.
- 정규 셔틀 좌표 설정: 정류장 한 곳씩 지도에서 직접 위치를 누르고 핀을 조정한 뒤 저장한다. 장소 검색은 보조 기능이며 배차 화면의 긴 누락 명단은 기본 접는다.
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

- 전달 누락 복구 최종 재QA: 구버전 셔틀 키가 현재 payload 누락을 가리지 않도록 정확한 안정 키 집합으로 선별하고, 담당자 전달 실패·0건은 `processed`가 아니라 `failed`로 집계하는 계약을 확인했다. 관련 회귀 71건·`tsc --noEmit`·`git diff --check` 통과, 실제 DB·푸시·외부 발송·배포 없음.
- 카카오 학부모 접수 최종 재QA: 카카오 챗봇·DB 사전점검·접수 라우팅과 정규/특강 결석·당일 셔틀 회귀 65건, `npx.cmd prisma validate`, `npx.cmd tsc --noEmit`, `git diff --check` 모두 통과했다. 확인 초안 없는 확인어는 신규 요청을 만들지 않으며, 도메인 반영 뒤 마감 기록 실패는 자동 재실행 없이 `PROCESSING`으로 남는 계약을 확인했다.
- DB 연결정보가 없어 운영 DB 구조 실조회는 명시적으로 건너뛰었으며, 미연결 시 실패 차단·명시적 skip만 허용하는 코드 계약은 통과했다. 실제 DB·카카오·문자·내부 알림 호출은 없었다.
- Solapi 묶음 발송 최종 재QA: 타깃 20건과 문자·장부 확대 회귀 129건, `npx.cmd tsc --noEmit`, `git diff --check` 모두 통과했다.
- `send-many/detail` 단일 접수·500명 상한·`customFields.deliveryId` 매칭, 4xx 실패/5xx·누락·timeout 불확실 분리, `groupInfo.groupId`·객체형 목록/customFields 호환, Bizppurio 순차 호환, `ACCEPTED`와 최종 `SENT` 분리, stale sweep의 ACCEPTED 제외, 결과 누락 10분 유예·그룹 5개 제한·페이지네이션·최종 집계·providerStatus 노출을 확인했다.
- 테스트는 실제 Solapi·Bizppurio·운영 DB를 호출하지 않았다. 신규 공급자 테스트는 소스 계약 검사 중심이므로 실제 응답 fixture 기반 분기 행동과 DB 상태 전이·페이지네이션 통합 검증은 후속 보강 권장이다.
- 기존 대량 SMS 큐의 500명 상한·멱등·암호화·UNCERTAIN 격리 회귀는 유지한다.

## 수정 요청

| 요청자 | 파일 | 문제 | 상태 |
|---|---|---|---|
| tester | `parent-regular-absence.ts`, `parent-shuttle-exception.ts` | 결석 반복 lifecycle 버전과 셔틀 동일 payload no-op/advisory lock, 누락 복구 선별로 보완 후 회귀 검증 완료 | 완료 |
| tester | 체험 일정/문자 경로 | Sat-2 canonical 시간, date-only 차단, stale Class 우선순위, 부모·담당자 동일 시간 보완 및 검증 완료 | 완료 |
| tester | `tests/regular-shuttle-location-link.test.mjs` | Prisma 가짜 어댑터 기반 roundtrip·경합·멱등 행동 테스트 보완 완료 | 완료 |
| reviewer | `src/lib/message-ledger.ts:101-125` | 암호문/키 오류 행을 UNCERTAIN 격리하고 나머지를 계속 처리하도록 보완됨 | 완료 |
| reviewer | `src/lib/message-ledger.ts:103-105,119` | stale·복호화 실패 UNCERTAIN 전환 때 payloadJSON을 즉시 제거하도록 보완됨 | 완료 |
| reviewer | `src/app/api/cron/manual-message-dispatch/route.ts:6-45` | 실행당 5건으로 축소해 공급자 최대 대기시간을 약 25초로 제한함 | 완료 |
| reviewer | `src/lib/message-ledger.ts:103-127`, `src/app/api/cron/manual-message-dispatch/route.ts:14-43` | stale·복호화 실패·정상 claim의 batchId를 모두 finalize 대상으로 전달해 배치 집계 정합성 보완 | 완료 |

## 확인보류
- 다음 개발: 추가확인 실제 전달 승인 흐름, 반 변경 전용 어댑터/완료 연결, 차액 PaymentInvoice 연결, 입학 완료 증거 직접 연결·영구 저장. 휴원·퇴원 완료 연결도 운영 DB/E2E 검증 전 배포 보류.

- 성인반 복귀 1건: 시트·Rallyz·사이트의 상태와 금액 기준이 달라 등록과 청구를 분리하고 확인보류한다.
- 다음 월 개강일과 청구 기준일은 실행 시 공식 연간일정표에서 재확인한다.
- RESUME/CLASS_ADD/CLASS_CHANGE 자동 실행 어댑터는 다음 그룹이다.
- 카카오 운영 적용은 전용 migration·비밀 환경변수·챗봇 관리자센터 스킬/블록 배포·단일 ACTIVE 처리기 승인이 필요하다.

## 작업 로그 (최근 10건)
- 2026-09-04: 세 타깃 성공·verifiedAt·원 신청/명령 관계·적용일·사이트 상태를 검증한 휴원/퇴원만 동일 거래에서 appliedAt·감사 확정. 대상 누락/중복은 SYNCED 차단. 회귀54·tsc·QA 통과, 실제 DB·발송·배포 없음.
- 2026-09-04: 신규 승인 반 필수·중복·정규반 잠금 검증, 인증 전 카카오 신청 안내, 후속/PROCESSING 표시, 입학 읽기전용 체크리스트, 수강변경 삼중 대기·알림 HELD·차액 기록 잠금을 구현. 확대 회귀 148건·tsc 통과, 실제 DB·발송·배포 없음. 완전 자동화는 후속 작업으로 남김.
- 2026-09-04: 관리자 보완 카카오 요청을 학부모가 24시간 일회용 링크에서 재확인하는 흐름을 추가했다. 링크 목적을 DB에서 분리하고 학생·보호자·접수·명령 관계 및 반 프로그램/요일/시간 스냅샷을 해시 검증하며, 확인은 감사와 parentConfirmed만 갱신한다. 회귀 65건·Prisma·tsc·lint·diff-check와 tester/reviewer 검증 통과, 운영 DB·발송·배포 없음.
- 2026-09-04: 카카오 접수함에서 학생명을 큰 제목으로 표시하고 형제 연결 자녀를 함께 보여주며 보호자명은 마스킹했다. 인증 챗봇은 연결 자녀 기준으로 `학생명 학생 학부모님`이라고 응답한다. 회귀 17건·tsc·lint·diff-check와 tester/reviewer 검증 통과, 운영 DB·발송·배포 없음.
- 2026-09-04: 카카오 관리자 접수함에 적용일·실제 현재반·희망 개설반·정원/중복·셔틀 의도 검증을 추가했다. 검증 완료 명령만 PENDING으로 이관하고 관리자 보완값은 학부모 재확인 대상으로 분리했으며 청구·알림·외부 반영은 HELD로 유지했다. 회귀 25건·tsc·lint·diff-check와 tester/reviewer 검증 통과, 운영 DB·발송·배포 없음.
- 2026-09-04: 학원 PC 인수인계를 위해 HANDOFF를 갱신하고 기존 운영 작업은 읽기 전용 재대조 후 승인 대기 원칙으로 고정했다. 운영 DB·시트·Rallyz·청구·알림·배포 변경 없음.
- 2026-09-04: 카카오 SUBMITTED/HELD/FAILED 접수함에 상태 필터, 인증·학생 ID 확인, 추가확인·상담·반려·운영 원장 이관과 감사 이력을 추가했다. 이관 명령은 HELD이며 시트·Rallyz·사이트 쓰기와 알림은 실행하지 않는다. 관련 회귀 23건·tsc·lint·diff-check 통과, 운영 DB·배포 없음.
- 2026-09-03: 결석·당일 셔틀 담당자 알림을 기존 NotificationDelivery/push-outbox에 연결해 채널별 상태·오류·시도를 기록하고 관리자 전달 장부와 5분 누락 복구를 추가했다. 반복 요청/취소 lifecycle·동시 셔틀 요청의 중복을 차단하고 최종 푸시 payload를 제거했으며 관련 회귀 71건·tsc·diff-check를 통과했다. 실제 DB·푸시·배포 없음.
- 2026-09-03: 정규 배차 운행별 담당 기사를 지정·검증·저장하고 결석 및 당일 셔틀 요청/취소를 해당 월·요일·방향·학생 ID의 고유 기사에게만 알리도록 보강했다. 미배정·비기사·복수 매칭은 원장 확인으로 차단했으며 관련 회귀 95건·tsc·diff-check를 통과했다. 실제 DB·알림·배포 없음.
- 2026-09-03: 클럽샵에서 본사 API가 `purchasable=false`로 반환한 재고 없는 상품을 고객 목록에서 자동으로 숨기도록 변경했다. 현재 대상은 STIZ 트레이닝 콘 1개이며 본사 상품·주문 데이터는 변경하지 않았다.

## PM 체크
- scratchpad 100줄 이내 및 작업 로그 최근 10건 유지.
- 오류·기술결정·구조·관례는 knowledge 파일에 반영.
- 운영 DB 변경·외부 발송·배포는 별도 승인.
