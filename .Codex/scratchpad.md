# STIZ Codex Scratchpad

## 작업 로그
- 2026-07-16: 관리자 신청/체험 목록을 서버 페이지 단위 로딩으로 전환하고 `/admin/apply` 첫 진입 payload를 축소했다.
- 2026-07-16: 체험/수강신청 관리자에 상담, 부재, 재연락 기록 기능을 추가하고 최신 연락 요약만 목록에 붙였다.
- 2026-07-16: 교사용 수업 종료 메모 자동 저장, 사진/청구 역할 복구, 연락 동의, 로딩/오류 화면을 개선했다.
- 2026-07-16: 체험 문의/수강신청 목록에 전화, 연락처 복사, 상담문 복사 액션을 추가했다.
- 2026-07-16: 교사용 공식 진입점, 개인 초대 링크, PWA 설치, SMS 실패 시 링크 복사 흐름을 보강했다.
- 2026-07-15: 학생 등록 데이터를 최신 7월 기준으로 정리하고 월별 수강 상태를 개인 히스토리와 현재 상태로 분리했다.
- 2026-07-15: 관리자 수납/결제에 청구서, Toss 온라인 결제 기록, 미납 확인, 현장 결제 반영 흐름을 추가했다.
- 2026-07-14: 체험 CRM과 수강신청 관리를 `/admin/apply` 통합 탭으로 정리했다.

## 현재 작업
- 작업명: 관리자 신청/체험 목록 속도 최적화
- 상태: 구현 및 검증 완료, 커밋 대기
- 범위: 신청/체험 목록 limit/offset, 초기 payload 축소, 더보기 서버 로딩
- 기준일: 2026-07-16

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 조회 함수 | 완료 | `getTrialLeads`, `getEnrollApplications`에 limit/offset 옵션 추가 |
| payload | 완료 | 통계는 전체 기준 유지, 목록은 50건 단위로 분리 |
| 첫 진입 | 완료 | `/admin/apply`는 체험 50건 + 수강신청 통계만 먼저 로딩 |
| 수강신청 탭 | 완료 | 탭 진입 시 목록 첫 50건 로딩 |
| 더보기 | 완료 | 다음 50건을 서버에서 이어 붙임 |
| 빈 필터 결과 | 완료 | 아직 서버에 다음 묶음이 있으면 추가 탐색 버튼 표시 |
| 검증 | 완료 | `tsc --noEmit`, `prisma validate`, `git diff --check` 통과 |

## 구현 기록
- `src/lib/queries.ts`: 관리자 목록 조회 옵션과 LIMIT/OFFSET 절 추가.
- `src/lib/adminReadPayloads.ts`: 신청/체험 payload를 페이지 단위 캐시 함수로 변경하고 수강신청 통계 전용 payload 추가.
- `src/app/admin/apply/page.tsx`: 첫 진입 데이터에서 수강신청 전체 목록 제거.
- `src/app/api/admin/apply/route.ts`: `limit`, `offset` query 지원.
- `src/app/api/admin/trial/route.ts`: `limit`, `offset` query 지원.
- `src/app/admin/apply/ApplyAdminClient.tsx`: 수강신청 탭 지연 로딩과 더보기 서버 로딩 적용.
- `src/app/admin/trial/TrialCrmClient.tsx`: 체험 문의 더보기 서버 로딩 적용.

## 테스트 결과
- `cmd /c node_modules\.bin\tsc.cmd --noEmit`: 통과
- `cmd /c node_modules\.bin\prisma.cmd validate`: 통과
- `git diff --check`: 통과

## PM 체크
- 작업 로그 최근 10건 이내 유지.
- scratchpad 100줄 이내 유지.
- 속도 결정 사항은 `decisions.md`, 반복 규칙은 `conventions.md`에 승격.
