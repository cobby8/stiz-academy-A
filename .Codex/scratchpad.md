# STIZ Codex Scratchpad

## 현재 작업
- 작업명: 방학특강 셔틀 노선 관리
- 상태: 구현 및 검증 완료, 커밋 준비
- 기준일: 2026-07-21

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| DB 모델 | 완료 | 차량, 노선 버전, 정류장, 탑승자, 감사 로그 테이블 추가 |
| 관리자 API | 완료 | 차량/노선 생성, 배정, 순서 변경, 확정, 보관, 수정본 생성 지원 |
| 관리자 화면 | 완료 | 특강 셔틀 노선 메뉴와 등원/하원 노선 편성 화면 추가 |
| 검증 | 완료 | TypeScript, Prisma validate, 셔틀 테스트, diff check 통과 |

## 구현 기록
- `prisma/schema.prisma`, `prisma/migrations/20260721223000_add_shuttle_route_planning/migration.sql`: 셔틀 노선 운영 모델 추가.
- `src/lib/shuttle/service.ts`, `src/app/api/admin/shuttle/route.ts`: 관리자 셔틀 노선 운영 API 추가.
- `src/app/admin/shuttle/ShuttleRouteAdminClient.tsx`, `src/app/admin/shuttle/page.tsx`: 노선 편성 관리자 화면 추가.
- `src/app/admin/AdminShellClient.tsx`: 특강 셔틀 노선 메뉴 추가.

## 테스트 결과
- `npx tsc --noEmit`: 통과
- `npx prisma validate`: 통과
- `node --test src\lib\shuttle\contracts.test.ts src\lib\shuttle\service.test.ts src\app\admin\shuttle\ShuttleRouteAdminClient.test.ts`: 14개 통과
- `git diff --check`: 통과

## 작업 로그
- 2026-07-21: 방학특강 셔틀 노선 운영용 차량·노선·정류장·탑승자·감사 로그 구조와 관리자 노선 편성 화면을 추가했다.
- 2026-07-21: 방학특강 승인 신청 반 여러 개를 선택해 수강 등록과 청구서를 한 번에 생성하고 실패 항목만 남겨 재처리할 수 있게 했다.
- 2026-07-21: 방학특강 신청에 카카오 지도 승하차 핀·좌표·동의 저장과 관리자 위치 확인을 추가하고 기존 텍스트 신청 및 필수 요일 제출 회귀를 보완했다.
- 2026-07-21: 방학특강 신청 목록에서 여러 학생/신청 반을 선택해 승인·대기·반려·취소를 일괄 처리할 수 있게 했다.
- 2026-07-21: 체험 문의와 수강신청 목록형을 div grid에서 실제 스프레드시트형 테이블 구조로 전환했다.
- 2026-07-21: 관리자 체험신청 카드형의 5열 grid를 제거해 PC에서 배지와 이름이 세로로 깨지는 문제를 수정했다.
- 2026-07-21: 체험신청 완료 화면에 체험수업비 입금 안내, 계좌번호 복사, 송금 정보 공유 흐름을 추가했다.
- 2026-07-21: 체험 신청 카드형 UI를 목록형과 같은 핵심 항목으로 단순화하고 한글 slotKey/요일+교시 기반 수업 시간 보정을 추가했다.
- 2026-07-21: 체험 신청 목록/카드에서 신청일, 희망일자, 수업교시, 확정일정을 크게 분리하고 DB 수업 시간 연결을 적용했다.
- 2026-07-21: 체험수업과 수강신청의 카드형/목록형 보기를 추가하고 목록형에서 필수 정보와 상태 처리를 빠르게 보이게 했다.

## PM 체크
- scratchpad 작업 로그 10건 이내 유지.
- scratchpad 100줄 이내 유지.
- 에러 발생 없음.
- 임시 파일과 개인 설정 파일은 커밋하지 않음.
