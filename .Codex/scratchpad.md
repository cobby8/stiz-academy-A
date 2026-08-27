# STIZ 작업 스크래치패드

## 현재 작업

- 목표: 사이트의 학생·수강 변경을 예약 대조 외에도 즉시 동기화 원장에 기록하고, 시트·랠리즈·사이트 정합성을 유지한다.
- 현재 단계: 이벤트 원장·외부 접수 API·사이트 수강 후크 구현 및 검증 완료.
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

## 구현 기록

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

- operations-events 및 operations-sync 회귀: 41/41 통과.
- TypeScript: `npx.cmd tsc --noEmit` 통과.
- 형식 검사: `git diff --check` 통과.
- 검증 항목: DB 원자성, 동일 상태 no-op, 날짜·월, plain object, 종류별 필수값, HMAC, replay, 64KB, 멱등 재접수, payload 충돌, HELD 정책, 하드 삭제 제거.
- 운영 DB·시트·Rallyz·알림·배포 호출 없음.

## 확인보류

- 박찬민: 시트 9월 화8 성인반은 퇴원/90,000원, Rallyz는 2026-08-25 퇴원·클래스 없음, 사이트는 Tue-8 성인반 PAUSED.
- 연간일정표 9월 개강일은 2026-09-01 화요일.
- 금액 불일치: 시트 90,000원 vs 사이트 성인반 기본가 120,000원. 복귀 등록과 청구를 분리하고 청구는 확인보류한다.
- RESUME/CLASS_ADD/CLASS_CHANGE 자동 실행 어댑터는 다음 그룹이다.

## 작업 로그 (최근 10건)

- 2026-08-27: 실시간 수강 변경 원장·외부 접수 API·관리자 후크 구현, 통합 회귀 41건·tsc·diff-check 통과.
- 2026-08-27: 동일 상태 DB 완전 no-op, 의미 기반 지문, 기존 PAUSE/WITHDRAW 계약 호환, 미지원 종류 HELD 보완.
- 2026-08-27: 수강 하드 삭제를 WITHDRAWN 이력 보존으로 전환하고 학생 상세 삭제 UI 제거.
- 2026-08-27: 월 청구 알림 필수 규칙 적용, 0원·명시 보류 제외 및 중복 방지 검증.
- 2026-08-27: 일8 대표팀 정규 셔틀비 전액 면제 규칙 구현·검증.
- 2026-08-27: 학부모 자연어 요청 확인·수정·승인대기 흐름 보안 회귀 완료.
- 2026-08-27: 운영 동기화 임대·재시도·감사로그·상태 집계 안정화.
- 2026-08-27: 정규 셔틀 월별 비교·변동 미리보기 구현, 발송 승인 게이트 유지.
- 2026-08-26: 구글 시트 휴원·퇴원 반영 어댑터와 재조회 검증 구현.
- 2026-08-26: 월 청구 3중 동기화 스킬 및 운영 원장 기반 구축.

## PM 체크

- scratchpad 100줄 이내 및 작업 로그 최근 10건 유지.
- 오류·기술결정·구조·관례는 knowledge 파일에 반영.
- 운영 DB 변경·외부 발송·배포는 별도 승인.
- 미추적 `_codex_locked_old/`는 작업 범위 밖이므로 건드리지 않는다.
