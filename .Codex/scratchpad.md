# STIZ Codex Scratchpad

## 현재 작업
- 작업명: 스프레드시트 운영 흐름을 DB 원본 운영으로 전환
- 상태: 수강생 시트 실데이터 이관과 관리자 확인 UI 보강
- 범위: 시간표 DB 원본화, 공개 조회 DB 우선 전환, 수강생 시트 원본/정규화 저장 모델
- 기준일: 2026-07-13

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 스프레드시트 의존 흐름 조사 | 완료 | 시간표가 핵심 의존 지점이고, 수강생/출석/수납은 이미 DB 중심 구조 |
| DB 운영 모델 설계 | 완료 | `ScheduleSlot`, `ScheduleImportBatch`, `ScheduleImportIssue` 설계 |
| 이관 검증/실행 액션 | 완료 | 기존 캐시/오버라이드/직접 슬롯을 검증 후 새 DB로 upsert |
| 등록 인원 기준 재정의 | 완료 | 이관 검증에서 시트 인원과 `Enrollment(ACTIVE)` 집계를 비교 |
| ScheduleSlot-Class 연결 | 완료 | 이관 성공 시 `Class`를 slotKey 기준으로 생성/갱신 |
| 관리자 UI 전환 | 완료 | `ScheduleSlot`이 있으면 관리자 시간표가 DB 원본을 우선 조회 |
| 공개 화면 조회 전환 | 완료 | `/schedule`, 수업 찾기, 챗봇, 점검봇이 `ScheduleSlot`을 우선 조회하고 없으면 기존 시트 캐시로 fallback |
| 수강생 시트 저장 구조 | 완료 | 원본 행 보존, 등록 원장, 차량, 변동내역, 대표팀 명단 저장 모델/SQL 추가 |
| 수강생 운영 연결 | 완료 | 최신 이관 요약, 시간표 차이, 차량/변동/대표팀/이슈 지연 조회 UI 추가 |
| 시간표 정합성 적용 | 완료 | 시트 기준 수강 등록 미리보기/적용 API와 관리자 진입점 추가 |
| 배포/검증/의존 제거 | 진행 중 | 수동 이관 후 캐시 무효화, 관리자 시간표 fallback 조회 축소 |

## 작업 로그
- 2026-07-13: 최신 시트 원장을 기준으로 수강 등록 누락/초과 활성 상태를 미리보고 적용할 수 있는 reconciliation API와 관리자 버튼을 추가했다.
- 2026-07-13: 실제 수강생 운영 시트를 DB에 이관하고, 최신 이관 요약/시간표 차이/차량·변동·대표팀·이슈 상세 지연 조회를 관리자 UI에 추가했다.
- 2026-07-13: 2026 다산점 가입신청서의 등록/차량/변동내역/대표팀 데이터를 모두 보존할 수 있도록 원본 행/정규화 저장용 Prisma 모델과 Supabase SQL을 추가했다.
- 2026-07-13: 공개 시간표/수업 찾기/챗봇/점검봇이 `ScheduleSlot`을 먼저 읽고, DB가 없을 때만 기존 시트 캐시로 fallback하도록 전환했다.
- 2026-07-13: 관리자 시간표 API/초기 payload가 `ScheduleSlot`을 우선 읽고, 기존 저장 액션이 `ScheduleSlot`과 `Class`에도 미러링되도록 보강했다.
- 2026-07-13: `ScheduleSlot` 이관 성공 시 같은 `slotKey`의 `Class`를 생성/갱신해 기존 `Enrollment` 집계와 끊기지 않게 연결했다.
- 2026-07-12: 시간표 이관 검증에서 시트 인원은 참고값으로만 보고, 실제 운영 인원은 `Class`와 `Enrollment(ACTIVE)` 집계 기준으로 비교하도록 보강했다.
- 2026-07-12: 관리자 시간표의 구글시트 연동 모달에 새 DB 이관 미리보기와 오류 없을 때 실행하는 버튼/결과 표시를 추가했다.
- 2026-07-12: 기존 Google Sheets 시간표 캐시, 슬롯 override, 직접 추가 슬롯을 새 `ScheduleSlot` 구조로 검증/이관하는 서버 액션을 추가했다.
- 2026-07-12: 시간표 DB 원본화를 위해 Prisma 모델과 운영 SQL 파일을 추가하고, Supabase public schema 노출을 피하도록 RLS/권한 기본값을 보수적으로 잡았다.
- 2026-07-12: 다크모드 브랜드 주황색이 라임으로 바뀌도록 전역 `--brand-accent` 안전망을 추가하고, PWA 헤더/차트/가이드/빠른 업로드 CTA를 보강했다.
- 2026-07-12: `/admin` 첫 진입 사이트 탭 적용을 확인하고, 브라우저/PWA 헤더와 주요 카드/뱃지/모달 잔여 다크모드 대비를 보강했다.
- 2026-07-12: 사이트 운영 점검 봇을 매일 KST 새벽 2시에 백그라운드 실행하도록 cron 엔드포인트와 Vercel 스케줄을 추가했다.
- 2026-07-12: 관리자 속도 추가 점검으로 원생 자동 전체 재조회 제거, 체험/수강신청 점진 렌더링, 원생 상태 계산 캐시, 관리자 조회용 SQL 인덱스를 추가했다.

## 구현 기록
- 변경 파일: `prisma/schema.prisma`, `prisma/sql/add_student_sheet_import.sql`
- 주요 변경:
  - `Student`에 지점, 농구경험, 바라는 점, 동의 원본, 마지막 이관 원본 행 필드 추가.
  - `StudentSheetImportBatch`/`StudentSheetRawRow`로 시트 행 전체를 원본 JSON으로 보존하는 구조 추가.
  - `StudentRegistrationLedger`, `StudentShuttleRide`, `StudentChangeLog`, `StudentTeamRosterEntry`, `StudentSheetImportIssue` 모델과 운영 SQL 추가.

## 테스트 결과
- `npx.cmd prisma validate`: 통과
- `npx.cmd tsc --noEmit`: 통과
- Supabase 읽기 검증: 최신 배치 `COMPLETED`, 등록 438/차량 2404/변동 146/대표팀 25/이슈 14 확인
- 변경 API/UI 린트: 통과
- 수강 등록 reconciliation 검증: 추가 32/정지 27/반 없음 0, 적용 SQL `EXPLAIN` 통과

## 다음에 할 것
- 관리자 화면에서 reconciliation 적용 후 남는 범위 밖 활성 학생 44명을 실제 운영 기준으로 검토한다.
