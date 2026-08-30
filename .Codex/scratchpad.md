# STIZ 작업 스크래치패드

## 현재 작업

- 목표: 신규 수강 승인과 외부 알림을 분리하고 변경을 세 시스템 동기화 원장에 안전하게 적재한다.
- 현재 단계: 코드 구현과 독립 QA 완료. 운영 배포 및 최율찬 실제 3중 동기화는 실행 직전 승인 대기.
- 운영 반영: 운영 DB 변경, 배포, 외부 알림 없음.
- 별도 실행 대기: 박찬민 2026-09 화요일 8교시 성인반 복귀 미리보기 승인.

## 진행 현황표

| 그룹 | 담당 | 상태 | 완료 기준 |
|---|---|---|---|
| 실시간 동기화 설계 | planner-architect | 완료 | 기존 Operations 원장 재사용과 단계별 구조 확정 |
| 사이트 변경 원장 | developer | 완료 | Enrollment 변경과 원장 적재 동일 트랜잭션 |
| 외부 이벤트 접수 | developer | 완료 | HMAC·재생 방지·멱등·충돌 차단 |
| 안전 검증 | tester + reviewer | 완료 | 통합 회귀 41건, tsc, diff-check 통과 |
| 원장 소비 워커 | 다음 그룹 | 대기 | PENDING 시트·랠리즈 시도 및 재조회 검증 |
| 박찬민 복귀 | PM | 승인 대기 | 세 시스템 반영 후 재조회, 청구는 금액 확인보류 |
| 신규 수강 안전 승인 | developer + tester + reviewer | 완료 | 알림 미발송·원장 원자성·멱등성·정적 검사 통과 |
| 최율찬 3중 동기화 | PM | 승인 대기 | 배포 후 시트→Rallyz→사이트 재조회, 외부 알림 없음 |

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

- 체험 일정/문자 canonical 시간 리뷰 보완 최종 QA: 신규·기존 회귀 54/54 통과, `tsc --noEmit`, Prisma validate, diff-check 통과.
- Sat-2는 활성 ScheduleSlot `10:50`을 선택해 `2026-08-29T10:50:00+09:00` 및 부모·담당자 표시 `2026년 8월 29일 (토) 10:50`으로 통일된다.
- 신규 신청은 날짜-only 희망일을 `scheduledDate` 자정으로 저장하지 않는다. 확정 서버가 날짜·slotKey·반 관계를 재검증하고 canonical scheduledDate로 교체한다.
- 활성 ScheduleSlot이 있으면 stale Class 시간보다 우선하며 적용일 비활성, 요일/반/slot 불일치, 숨김, 시간 매핑 실패는 발송 전 차단한다.
- 수동 담당자 알림은 `scheduledDate`를 우선하고 같은 canonical resolver·서울 시간 포맷을 사용한다. UI도 날짜-only placeholder와 stale Class 폴백을 확정시간으로 사용하지 않는다.
- 관리자가 명시한 유효 확정시각 11:10은 날짜·반·slot 관계 검증 후 보존한다. 날짜-only 입력은 Sat-2 canonical 10:50으로 채운다.
- 순수 resolver 행동 테스트로 활성기간 시작/종료 경계, override, hidden, custom/Class 폴백, 시간 누락, 반·slot·요일 불일치를 실제 행 조합으로 실행 검증했다.

- 정규 셔틀 위치 링크 신규/UI 및 관리자·수강신청·지도 선택기·셔틀 회귀: 170/170 통과.
- TypeScript `npx.cmd tsc --noEmit`, `npx.cmd prisma validate`, `git diff --check` 통과.
- 토큰 SHA-256 해시·만료·취소·학생/보호자/용도 고정, 좌표/source/동의 검증, 동일 학생·방향 upsert, 공개 UI 모바일 레이아웃·오류 안내 계약을 확인했다.
- 가짜 DB 행동 테스트로 `저장 → 서버 재조회` 왕복, 동일 payload 무부작용 재시도, 저장 직전 취소·만료 경합을 검증했다. 관리자 GET 상태·취소·재발급, 공개 응답 note 제외, no-store/noindex/no-referrer, 위치 권한 범위, UI 상태 배지·취소도 통과했다.
- 운영 DB·외부 문자·배포 호출 없음.

## 수정 요청

| 요청자 | 파일 | 문제 | 상태 |
|---|---|---|---|
| tester | 체험 일정/문자 경로 | Sat-2 canonical 시간, date-only 차단, stale Class 우선순위, 부모·담당자 동일 시간 보완 및 검증 완료 | 완료 |
| tester | `tests/regular-shuttle-location-link.test.mjs` | Prisma 가짜 어댑터 기반 roundtrip·경합·멱등 행동 테스트 보완 완료 | 완료 |

## 확인보류

- 박찬민: 시트 9월 화8 성인반은 퇴원/90,000원, Rallyz는 2026-08-25 퇴원·클래스 없음, 사이트는 Tue-8 성인반 PAUSED.
- 연간일정표 9월 개강일은 2026-09-01 화요일.
- 금액 불일치: 시트 90,000원 vs 사이트 성인반 기본가 120,000원. 복귀 등록과 청구를 분리하고 청구는 확인보류한다.
- RESUME/CLASS_ADD/CLASS_CHANGE 자동 실행 어댑터는 다음 그룹이다.

## 작업 로그 (최근 10건)
- 2026-08-30: 수강 승인과 외부 알림을 분리하고 신규·복귀 수강 변경을 운영 원장에 같은 트랜잭션으로 적재했다. 관련 14건·독립 QA·tsc·Prisma·diff 검사 통과, 운영 DB·알림·배포 없음.
- 2026-08-29: Codex 공용 운영 인수인계 기반을 추가했다. AGENTS·저장소 스킬·PC 설정 런북·HANDOFF·구조 안전 테스트를 만들었고 운영 DB·예약·외부 발송·배포는 변경하지 않았다.
- 2026-08-28: 실사용성이 낮은 관리자 `3중 동기화` 화면과 메뉴를 폐기하고 기존 URL은 관리자 홈으로 이동했다. 학부모 링크 관리는 학생 상세로 옮기고 공개 요청·원장·출석·청구 백엔드는 보존했다. 운영 DB·푸시·배포 없음.
- 2026-08-28: 운영 동기화 관리자 화면의 간헐 오류를 진단해 SSR 런타임 DDL을 제거하고 7개 테이블·85개 컬럼·고유키·RLS·직접 권한을 읽기 전용으로 검사하도록 보강했다. 운영 DB·푸시·배포 없음.
- 2026-08-28: 정규 배차 운영 장애 복구. 누락된 `RegularShuttleStop.studentId` 구조만 적용해 관리자·배차·기사 화면을 정상화하고 Vercel 배포 전 21개 필수 DB 컬럼 읽기검사를 추가했다. 문자·기존 차량 데이터 변경 없음.
- 2026-08-28: 체험 CRM 표시·처리 흐름 정리. 상세 학년 중복 제거, 유입경로 한글화, 빠른 실행 단순화, 안전한 상태 전이, 입금확인·감사기록 원자 처리와 진행 피드백을 구현. 운영 DB·문자·배포 없음.
- 2026-08-27: 체험 시간 리뷰 보완 최종 QA 승인. 수동 11:10 보존과 실제 resolver 행 조합 행동검증 포함 54건·tsc·Prisma validate·diff-check 통과. 운영 DB·문자·배포 없음.
- 2026-08-27: 체험 일정/문자 canonical 시간 최종 QA 승인. Sat-2 10:50, 날짜-only 차단, TZ 독립, stale Class/매핑 실패 차단 포함 53건·tsc·Prisma validate·diff-check 통과. 운영 DB·문자·배포 없음.
- 2026-08-27: 체험 문자 canonical 시간 서버 보강. 날짜 전용 희망일의 scheduledDate 자정 저장을 중단하고 적용일 기준 override→활성 시간표→custom→Class 우선순위로 서울시각을 결합했으며 불일치·비활성 시간표는 발송 차단했다. 관련 36개 테스트·tsc·Prisma validate·diff-check 통과. 문자·운영 DB·배포 미실행.
- 2026-08-27: 체험 문자 시간 읽기 전용 진단. 관련 25건은 통과했지만 Sat-2 10:50 종단간 검증이 없고 date-only 09:00 및 stale Class 12:00 경로를 확인. 소스·운영 DB·문자 미변경.

## PM 체크

- scratchpad 100줄 이내 및 작업 로그 최근 10건 유지.
- 오류·기술결정·구조·관례는 knowledge 파일에 반영.
- 운영 DB 변경·외부 발송·배포는 별도 승인.
- 미추적 `_codex_locked_old/`는 작업 범위 밖이므로 건드리지 않는다.
