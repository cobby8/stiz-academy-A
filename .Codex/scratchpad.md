# STIZ Codex Scratchpad

## 현재 작업
- 작업명: 방학특강 셔틀 지도 위치 수집
- 상태: 구현 및 검증 완료, 커밋 준비
- 기준일: 2026-07-21

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 공개 신청 지도 선택 | 완료 | 카카오 지도 SDK 지연 로딩, 키 누락 시 텍스트 입력 fallback |
| 위치 동의/계약 | 완료 | 지도 좌표 저장 시 서버 고정 동의 버전과 명시적 동의 검증 |
| DB 저장 | 완료 | 승하차 주소, 좌표, 선택 방식, 정확도, 제출 시각 저장 컬럼 추가 |
| 관리자 확인 | 완료 | 신청 상세에서 좌표, 제출 시각, 카카오/네이버 지도 링크 확인 |
| 검증 | 완료 | TypeScript, 위치 선택, 계약, 관리자 상세 테스트 통과 |

## 구현 기록
- `src/components/maps/LocationPickerModal.tsx`: 카카오 지도 위치 선택 모달 추가.
- `src/components/seasonal/SeasonalApplyClient.tsx`: 셔틀 승하차 지도 위치 선택과 위치정보 동의 payload 추가.
- `src/lib/seasonal/contracts.ts`, `src/lib/seasonal/service.ts`: 위치 좌표 검증과 DB 저장 처리 추가.
- `prisma/schema.prisma`, `prisma/migrations/20260721153000_add_special_program_shuttle_map_locations/migration.sql`: 셔틀 위치 저장 컬럼과 제약 추가.
- `src/app/admin/seasonal/SeasonalAdminClient.tsx`: 관리자 상세에서 지도 제출 위치와 외부 지도 링크 표시.

## 테스트 결과
- `npx tsc --noEmit`: 통과
- `npx prisma validate`: 통과
- `node --test tests\seasonal-location-picker.test.mjs src\lib\seasonal\contracts.test.ts src\app\admin\seasonal\SeasonalAdminClient.test.ts tests\seasonal-admin-ux.test.mjs`: 32개 통과
- `git diff --check`: 통과

## 작업 로그
- 2026-07-21: 방학특강 신청에 카카오 지도 승하차 핀·좌표·동의 저장과 관리자 위치 확인을 추가하고 기존 텍스트 신청 및 필수 요일 제출 회귀를 보완했다.
- 2026-07-21: 방학특강 신청 목록에서 여러 학생/신청 반을 선택해 승인·대기·반려·취소를 일괄 처리할 수 있게 했다.
- 2026-07-21: 체험 문의와 수강신청 목록형을 div grid에서 실제 스프레드시트형 테이블 구조로 전환했다.
- 2026-07-21: 관리자 체험신청 카드형의 5열 grid를 제거해 PC에서 배지와 이름이 세로로 깨지는 문제를 수정했다.
- 2026-07-21: 체험신청 완료 화면에 체험수업비 입금 안내, 계좌번호 복사, 송금 정보 공유 흐름을 추가했다.
- 2026-07-21: 체험 신청 카드형 UI를 목록형과 같은 핵심 항목으로 단순화하고 한글 slotKey/요일+교시 기반 수업 시간 보정을 추가했다.
- 2026-07-21: 체험 신청 목록/카드에서 신청일, 희망일자, 수업교시, 확정일정을 크게 분리하고 DB 수업 시간 연결을 적용했다.
- 2026-07-21: 체험수업과 수강신청의 카드형/목록형 보기를 추가하고 목록형에서 필수 정보와 상태 처리를 빠르게 보이게 했다.
- 2026-07-21: 관리자 신청 관리 메뉴와 카드 액션을 단순화해 모바일에서 버튼과 배지가 세로로 깨지는 문제를 정리했다.

## PM 체크
- scratchpad 작업 로그 10건 이내 유지.
- scratchpad 100줄 이내 유지.
- 에러 발생 없음.
- 임시 파일과 개인 설정 파일은 커밋하지 않음.
