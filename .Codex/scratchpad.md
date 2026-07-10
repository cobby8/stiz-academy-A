# STIZ 고도화 스크래치패드

## 현재 작업
- 작업명: 시간표 관리 백그라운드 로딩
- 상태: 빌드 검증 완료
- 범위: `/admin/schedule`, `/api/admin/schedule`
- 기준일: 2026-07-10

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 프로젝트 현황 파악 | 완료 | Next.js + Supabase + Prisma 기반 학원 홈페이지/관리 플랫폼 |
| 관리자 권한 보호 | 완료 | `/admin` 서버 레이아웃에서 DB role 기준 권한 확인 |
| 업로드 UX 개선 | 완료 | 병렬 업로드, 진행률 표시, 성공 메시지 보강 |
| 홈 공지/인스타 갤러리 보강 | 완료 | 히어로 공지 목록 추가, Instagram CDN 이미지 허용 |
| 전역 속도 병목 개선 | 완료 | 홈 폰트 preload/아이콘/모달/초기 JS 부담 축소 |
| 관리자 링크 prefetch 차단 | 완료 | 누르지 않은 관리자 route의 배경 조회를 줄임 |
| 관리자 DDL 진입 제거 | 완료 | 읽기 화면에서는 테이블 보장 작업을 실행하지 않도록 이동 |
| 관리자 화면 skeleton/streaming | 완료 | 주요 목록/설정 화면은 skeleton을 먼저 표시 |
| 원생 목록 백그라운드 로딩 | 완료 | `/admin/students` 서버 조회를 클라이언트 API로 분리 |
| 관리자 셸 배경 API 지연 | 완료 | 체험 신청/알림 조회를 idle 이후로 지연 |
| 원생 상세 백그라운드 로딩 | 완료 | 원생 활동/출석/결제/갤러리 조회를 클라이언트 API로 분리 |
| 반 상세 백그라운드 로딩 | 완료 | 반/수강생/수업기록/코치 조회를 클라이언트 API로 분리 |
| 관리자 대시보드 백그라운드 로딩 | 완료 | `/admin` 서버 렌더에서 통계/요청/백업 조회 제거 |
| 운영 통계 화면 백그라운드 로딩 | 완료 | `/admin/stats` 서버 렌더에서 7개 통계 집계 제거 |
| 체험수업 CRM 백그라운드 로딩 | 완료 | `/admin/trial` 서버 렌더에서 리드/통계 조회 제거 |
| 스태프 관리 백그라운드 로딩 | 완료 | `/admin/staff` 서버 렌더에서 스태프/코치/초대 조회 제거 |
| 대기자 관리 백그라운드 로딩 | 완료 | `/admin/waitlist` 서버 렌더에서 대기/정원/반 조회 제거 |
| 수강 신청 관리 백그라운드 로딩 | 완료 | `/admin/apply` 서버 렌더에서 신청/통계/반/설정 조회 제거 |
| 수납 관리 백그라운드 로딩 | 완료 | `/admin/finance` 서버 렌더에서 수납 목록/요약 조회 제거 |
| 보강 관리 백그라운드 로딩 | 완료 | `/admin/makeup` 서버 렌더에서 보강 예약/반 조회 제거 |
| 수업 리포트 목록 백그라운드 로딩 | 완료 | `/admin/attendance/report` 서버 렌더에서 최근 수업 리포트 조회 제거 |
| 시간표 관리 백그라운드 로딩 | 완료 | `/admin/schedule` 서버 렌더에서 설정/시간표/코치/프로그램/시트 조회 제거 |
| 타입/빌드 검증 | 완료 | `npx.cmd tsc --noEmit`, `npx.cmd next build` 통과 |

## 작업 로그
- 2026-07-10: `/admin/schedule` 설정/시간표 override/코치/직접 슬롯/프로그램/Google Sheets 조회를 서버 렌더에서 제거하고, `/api/admin/schedule`로 클라이언트에서 불러오도록 변경함.
- 2026-07-10: `/admin/attendance/report` 최근 수업 리포트 목록 조회를 서버 렌더에서 제거하고, `/api/admin/attendance/report`로 클라이언트에서 불러오도록 변경함.
- 2026-07-10: `/admin/makeup` 보강 예약/반 목록 조회를 서버 렌더에서 제거하고, `/api/admin/makeup`로 클라이언트에서 불러오도록 변경함.
- 2026-07-10: `/admin/finance` 수납 목록/요약 조회를 서버 렌더에서 제거하고, `/api/admin/finance`가 결제 목록과 요약을 함께 반환하도록 변경함.
- 2026-07-10: `/admin/apply` 신청/통계/반 조회를 서버 렌더에서 제거하고, 안내 설정은 설정 탭 진입 시 `/api/admin/apply/settings`로 불러오도록 분리함.
- 2026-07-10: `/admin/waitlist` 대기자/정원/반 목록 조회를 서버 렌더에서 제거하고, `/api/admin/waitlist`로 클라이언트에서 불러오도록 변경함.
- 2026-07-10: `/admin/staff` 스태프/코치/초대 목록 조회를 서버 렌더에서 제거하고, `/api/admin/staff`로 클라이언트에서 불러오도록 변경함.
- 2026-07-10: `/admin/trial` 체험수업 CRM의 리드/통계 조회를 서버 렌더에서 제거하고, `/api/admin/trial`로 클라이언트에서 불러오도록 변경함.
- 2026-07-10: `/admin/stats` 운영 통계의 7개 집계 조회를 서버 렌더에서 제거하고, `/api/admin/stats`로 클라이언트에서 불러오도록 변경함.
- 2026-07-10: `/admin` 대시보드의 통계/최근 요청/오늘 수업 조회를 서버 렌더에서 제거하고, `/api/admin/dashboard`와 `/api/admin/dashboard/system`으로 클라이언트에서 불러오도록 변경함.

## 구현 기록
- 변경 파일: `src/app/admin/schedule/page.tsx`, `src/app/admin/schedule/ScheduleAdminClient.tsx`, `src/app/api/admin/schedule/route.ts`
- 주요 변경: 시간표 화면 진입 시 설정/시간표/코치/프로그램/Google Sheets 조회를 클라이언트 API로 분리하고, 저장/추가/수정/삭제 후 전체 새로고침 대신 API 재조회로 갱신.
- 적용 범위: `/admin/schedule`

## 테스트 결과
- `npx.cmd tsc --noEmit` 통과
- `npx.cmd next build` 통과
- 빌드 중 Supabase DB 접속 실패 로그는 로컬 네트워크 제한으로 발생했지만 fallback 처리되어 빌드 종료 코드는 0.

## 다음에 할 것
- 다음 속도 개선 후보: 빌드 중 남은 DB 로그가 많은 `/admin/finance/billing`, `/admin/skills`, 공개 페이지 DB 호출 계열을 추가 점검.
