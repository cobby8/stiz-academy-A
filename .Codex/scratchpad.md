# STIZ Codex Scratchpad

## 현재 작업
- 작업명: 스프레드시트 운영 흐름을 DB 원본 운영으로 전환
- 상태: 4단계 진행 중
- 범위: 시간표 DB 모델, 이관 검증/실행 액션, 관리자 이관 UI
- 기준일: 2026-07-12

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 스프레드시트 의존 흐름 조사 | 완료 | 시간표가 핵심 의존 지점이고, 수강생/출석/수납은 이미 DB 중심 구조 |
| DB 운영 모델 설계 | 완료 | `ScheduleSlot`, `ScheduleImportBatch`, `ScheduleImportIssue` 설계 |
| 이관 검증/실행 액션 | 완료 | 기존 캐시/오버라이드/직접 슬롯을 검증 후 새 DB로 upsert |
| 등록 인원 기준 재정의 | 완료 | 이관 검증에서 시트 인원과 `Enrollment(ACTIVE)` 집계를 비교 |
| 관리자 UI 전환 | 진행 중 | 구글시트 연동 모달에 이관 미리보기/실행 컨트롤 추가 |
| 공개 화면 조회 전환 | 대기 | 실제 DB SQL 적용과 이관 후 `/schedule`, 챗봇, 점검봇 순서로 전환 |
| 수강생 운영 연결 | 대기 | `Enrollment`와 새 `ScheduleSlot`/`Class` 연결 정책 확정 필요 |
| 배포/검증/의존 제거 | 대기 | SQL 적용, 실데이터 검증, 구글시트 fallback 제거 순서 |

## 작업 로그
- 2026-07-12: 시간표 이관 검증에서 시트 인원은 참고값으로만 보고, 실제 운영 인원은 `Class`와 `Enrollment(ACTIVE)` 집계 기준으로 비교하도록 보강했다.
- 2026-07-12: 관리자 시간표의 구글시트 연동 모달에 새 DB 이관 미리보기와 오류 없을 때 실행하는 버튼/결과 표시를 추가했다.
- 2026-07-12: 기존 Google Sheets 시간표 캐시, 슬롯 override, 직접 추가 슬롯을 새 `ScheduleSlot` 구조로 검증/이관하는 서버 액션을 추가했다.
- 2026-07-12: 시간표 DB 원본화를 위해 Prisma 모델과 운영 SQL 파일을 추가하고, Supabase public schema 노출을 피하도록 RLS/권한 기본값을 보수적으로 잡았다.
- 2026-07-12: 다크모드 브랜드 주황색이 라임으로 바뀌도록 전역 `--brand-accent` 안전망을 추가하고, PWA 헤더/차트/가이드/빠른 업로드 CTA를 보강했다.
- 2026-07-12: `/admin` 첫 진입 사이트 탭 적용을 확인하고, 브라우저/PWA 헤더와 주요 카드/뱃지/모달 잔여 다크모드 대비를 보강했다.
- 2026-07-12: 사이트 운영 점검 봇을 매일 KST 새벽 2시에 백그라운드 실행하도록 cron 엔드포인트와 Vercel 스케줄을 추가했다.
- 2026-07-12: 관리자 속도 추가 점검으로 원생 자동 전체 재조회 제거, 체험/수강신청 점진 렌더링, 원생 상태 계산 캐시, 관리자 조회용 SQL 인덱스를 추가했다.
- 2026-07-12: 홈페이지 첫 방문 기본 테마를 다크모드로 변경했다.
- 2026-07-12: 관리자 사이드바 백업/복원/시트 동기화 도구를 lazy load로 전환해 첫 진입 JS 부담을 줄였다.

## 구현 기록
- 변경 파일: `src/lib/scheduleSlotImport.ts`, `src/app/actions/scheduleSlotImport.ts`, `src/app/admin/schedule/ScheduleAdminModals.tsx`
- 주요 변경:
  - 이관 미리보기에서 `Class.slotKey`별 `Enrollment(ACTIVE)` 인원을 집계.
  - 시트 인원과 실제 등록 인원이 다르면 warning으로 표시.
  - 관리자 모달 요약에 `인원 차이` 카드를 추가하고, 운영 인원 기준을 등록 데이터로 안내.

## 테스트 결과
- `npx.cmd tsc --noEmit`: 통과

## 다음에 할 것
- live DB에 `prisma/sql/add_schedule_slots.sql`을 적용한 뒤, 관리자 모달에서 이관 미리보기를 실제 데이터로 확인한다.
- 이관 완료 후 `/admin/schedule` 읽기 원본을 `SheetSlotCache`가 아니라 `ScheduleSlot` 우선으로 바꾼다.
