# STIZ 고도화 스크래치패드

## 현재 작업
- 작업명: 이용약관 백그라운드 로딩
- 상태: 빌드 검증 완료
- 범위: `/admin/terms`, `/api/admin/settings`
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
| 청구 템플릿 백그라운드 로딩 | 완료 | `/admin/finance/billing` 서버 렌더에서 템플릿/프로그램 조회 제거 |
| 스킬 카테고리 백그라운드 로딩 | 완료 | `/admin/skills` 서버 렌더에서 스킬 카테고리 조회 제거 |
| 반 관리 백그라운드 로딩 | 완료 | `/admin/classes` 서버 렌더에서 프로그램/반 목록 조회 제거 |
| 코치 관리 백그라운드 로딩 | 완료 | `/admin/coaches` 서버 렌더에서 코치 목록 조회 제거 |
| 연간일정 관리 백그라운드 로딩 | 완료 | `/admin/annual` 서버 렌더에서 일정/ICS 설정 조회 제거 |
| 후기 관리 백그라운드 로딩 | 완료 | `/admin/testimonials` 서버 렌더에서 후기/네이버 링크 조회 제거 |
| FAQ 관리 백그라운드 로딩 | 완료 | `/admin/faq` 서버 렌더에서 FAQ 목록 조회 제거 |
| 출석 관리 백그라운드 로딩 | 완료 | `/admin/attendance` 서버 렌더에서 반 목록 조회 제거 |
| 공지 관리 백그라운드 로딩 | 완료 | `/admin/notices` 서버 렌더에서 공지/반 목록 조회 제거 |
| 프로그램 관리 백그라운드 로딩 | 완료 | `/admin/programs` 서버 렌더에서 프로그램 목록 조회 제거 |
| 요청 관리 백그라운드 로딩 | 완료 | `/admin/requests` 서버 렌더에서 학부모 요청 목록 조회 제거 |
| 갤러리 관리 백그라운드 로딩 | 완료 | `/admin/gallery` 서버 렌더에서 갤러리/반/설정/초안 조회 제거 |
| 피드백 관리 백그라운드 로딩 | 완료 | `/admin/feedback` 서버 렌더에서 피드백 목록 조회 제거 |
| SMS 템플릿 백그라운드 로딩 | 완료 | `/admin/sms/templates` 서버 렌더에서 템플릿 조회/보장 작업 제거 |
| 학원 설정 백그라운드 로딩 | 완료 | `/admin/settings` 서버 렌더에서 학원 설정 조회 제거 |
| 개인정보처리방침 백그라운드 로딩 | 완료 | `/admin/privacy` 서버 렌더에서 개인정보 설정 조회 제거 |
| 이용약관 백그라운드 로딩 | 완료 | `/admin/terms` 서버 렌더에서 이용약관 설정 조회 제거 |
| 타입/빌드 검증 | 완료 | `npx.cmd tsc --noEmit`, `npx.cmd next build` 통과 |

## 작업 로그
- 2026-07-10: `/admin/terms` 이용약관 조회를 서버 렌더에서 제거하고, 기존 `/api/admin/settings`로 클라이언트에서 불러오도록 변경함.
- 2026-07-10: `/admin/privacy` 개인정보처리방침 조회를 서버 렌더에서 제거하고, 기존 `/api/admin/settings`로 클라이언트에서 불러오도록 변경함.
- 2026-07-10: `/admin/settings` 학원 설정 조회를 서버 렌더에서 제거하고, `/api/admin/settings`로 클라이언트에서 불러오도록 변경함.
- 2026-07-10: `/admin/sms/templates` SMS 템플릿 조회를 서버 렌더에서 제거하고, `/api/admin/sms/templates`로 클라이언트에서 불러오도록 변경함.
- 2026-07-10: `/admin/feedback` 피드백 목록 조회를 서버 렌더에서 제거하고, `/api/admin/feedback`로 클라이언트에서 불러오도록 변경함.
- 2026-07-10: `/admin/gallery` 갤러리/반/인스타 설정/소셜 초안 조회를 서버 렌더에서 제거하고, `/api/admin/gallery`로 클라이언트에서 불러오도록 변경함.
- 2026-07-10: `/admin/requests` 학부모 요청 목록 조회를 서버 렌더에서 제거하고, `/api/admin/requests`로 클라이언트에서 불러오도록 변경함.
- 2026-07-10: `/admin/programs` 프로그램 목록 조회를 서버 렌더에서 제거하고, `/api/admin/programs`로 클라이언트에서 불러오도록 변경함.
- 2026-07-10: `/admin/notices` 공지/반 목록 조회를 서버 렌더에서 제거하고, `/api/admin/notices`로 클라이언트에서 불러오도록 변경함.
- 2026-07-10: `/admin/attendance` 반 목록 조회를 서버 렌더에서 제거하고, `/api/admin/attendance`가 반 목록과 날짜별 출석 조회를 함께 담당하도록 변경함.

## 구현 기록
- 변경 파일: `src/app/admin/terms/page.tsx`, `src/app/admin/terms/TermsAdminClient.tsx`
- 주요 변경: 이용약관 조회를 기존 설정 API로 분리하고, 로딩 중 skeleton을 클라이언트에서 표시.
- 적용 범위: `/admin/terms`

## 테스트 결과
- `npx.cmd tsc --noEmit` 통과
- `npx.cmd next build` 통과
- 빌드 중 Supabase DB 접속 실패 로그는 로컬 네트워크 제한으로 발생했지만 fallback 처리되어 빌드 종료 코드는 0.

## 다음에 할 것
- 다음 속도 개선 후보: 빌드 중 남은 DB 로그가 많은 공개 페이지 DB 호출 계열, `/admin/privacy`, `/admin/terms`, `/admin/settings`, `/admin/sms/templates` 계열을 추가 점검.
