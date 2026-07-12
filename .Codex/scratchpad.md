# STIZ Codex Scratchpad

## 현재 작업
- 작업명: 관리자 대시보드/원생 관리 1차 속도 개선
- 상태: 구현 및 검증 완료, 커밋 준비 중
- 범위: `/admin`, `/admin/students`, 관리자 읽기 payload 공용화
- 기준일: 2026-07-11

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 프로젝트 현황 파악 | 완료 | Next.js + Supabase + Prisma 기반 학원 홈페이지/관리 플랫폼 |
| 관리자 권한 보호 | 완료 | `/admin` 서버 레이아웃에서 DB role 기반 권한 확인 |
| 관리자 링크 prefetch 차단 | 완료 | 보이지 않는 관리자 route 배경 조회 감소 |
| 관리자 DDL 진입 제거 | 완료 | 읽기 화면에서 테이블/인덱스 보장 작업 제거 |
| 관리자 인증 경량화 | 완료 | Supabase `getClaims()` 우선 사용, role 조회 단기 캐시 |
| 관리자 공통 배경 조회 제거 | 완료 | 알림은 클릭 시 조회, trial-count 자동 조회 제거 |
| Google Sheets 수동 동기화 | 완료 | 화면은 DB 캐시만 읽고 수동 버튼으로 외부 시트 동기화 |
| 관리자 읽기 API 캐시 | 완료 | dashboard/finance/stats/content/operation API 서버 캐시 적용 |
| 주요 메뉴 초기 데이터 주입 | 완료 | students/classes/trial 첫 진입 API 재호출 제거 |
| 프로그램/시간표 본문 지연 제거 | 완료 | programs/schedule 첫 진입 API 재호출 제거 |
| 대시보드 초기 렌더 경량화 | 완료 | 무거운 월별 통계/최근 목록은 첫 화면 후 백그라운드 로딩 |
| 원생 목록 렌더 제한 | 완료 | 최초 50명만 그린 뒤 필요 시 더 보기 |
| 검증 | 완료 | `npx.cmd tsc --noEmit` 통과 |

## 작업 로그
- 2026-07-12: 실제 Chrome 로그인 세션 기준 실서버 `/admin` 첫 진입 DOM 9.46초, 재로드 0.84초, 홈페이지 0.35~0.56초로 확인. Vercel 함수 기본 리전과 Supabase Seoul DB 거리 문제가 큰 원인으로 보여 `vercel.json`에 `regions: ["icn1"]` 적용.
- 2026-07-11: `/admin` 콜드 진입이 약 25초까지 느린 것을 운영 탭에서 확인하고, 대시보드는 가벼운 핵심 요약을 먼저 렌더링한 뒤 월별 통계/최근 목록을 백그라운드에서 채우도록 분리.
- 2026-07-11: `/admin/students`가 DOM 3천 개 이상과 버튼 700개 이상을 한 번에 그려 느려지는 것을 확인하고, 초기 렌더는 50명만 표시하며 “50명 더 보기”로 점진 표시하도록 변경.
- 2026-07-11: 운영 관리자 탭에서 `/admin/programs`, `/admin/schedule`가 셸은 1초대에 뜨지만 본문은 약 5초 뒤 붙는 것을 확인하고, 서버 캐시 payload를 첫 렌더링에 주입해 추가 API 왕복을 제거.
- 2026-07-11: `/admin/students`, `/admin/classes`, `/admin/trial` 페이지가 서버에서 캐시된 초기 데이터를 받아 렌더링하도록 바꾸고, 첫 진입 시 같은 API를 클라이언트에서 다시 호출하던 왕복을 제거.
- 2026-07-11: DB 계측 결과 SQL 자체보다 반복 API/auth/왕복 비용이 병목에 가까워, 전역 `trial-count` 자동 조회 제거 및 운영 데이터 API 6개에 서버 캐시 적용.
- 2026-07-11: 프로그램/코치/FAQ/연간일정/SMS 템플릿/청구 템플릿 관리자 API에 60초 서버 캐시 적용 및 저장 액션 캐시 무효화.
- 2026-07-11: Google Sheets 시간표 자동 cron 제거, 관리자 수동 동기화 버튼으로 `SheetSlotCache` 저장 후 화면은 DB 캐시만 읽도록 전환.
- 2026-07-11: `/api/admin/finance`, `/api/admin/stats`에 단기 private/server cache 적용 및 관련 저장 작업 후 캐시 무효화.
- 2026-07-11: `/api/admin/dashboard` 15초 cache, `/api/admin/dashboard/system` 수동 확인형으로 변경.
- 2026-07-11: 관리자 공통 헤더의 알림 자동 조회와 DDL/index 자동 보장 호출 제거.

## 구현 기록
- 변경 파일: `src/lib/adminReadPayloads.ts`, `src/app/admin/page.tsx`, `src/app/admin/AdminDashboardClient.tsx`, `src/app/api/admin/dashboard/route.ts`, `src/app/admin/students/StudentManagementClient.tsx`
- 주요 변경: 대시보드 첫 화면 payload를 핵심 요약과 상세 통계로 나누고, 원생 목록은 최초 50명만 렌더링하도록 했다.
- 의도: 선생님이 바로 보는 화면은 먼저 띄우고, 무거운 통계/긴 목록은 필요할 때 조금씩 붙여 관리자 체감 속도를 개선한다.

## 테스트 결과
- `npx.cmd tsc --noEmit` 통과
- `npm.cmd run build` 통과. 로컬 네트워크에서 Supabase pooler 접속 경고가 출력됐지만 빌드는 exit code 0으로 완료됨.
- 운영 탭 계측: 기존 `/admin` 콜드 진입 약 25초, `/admin/students` DOM 3,142개/버튼 737개로 확인

## 다음에 할 것
- 배포 후 실제 로그인 세션에서 `/admin`, `/admin/students` 체감 표시 시간이 줄었는지 재측정.
- 남은 느린 화면은 “처음 꼭 보여야 하는 데이터”와 “필요할 때만 보는 보조 데이터”로 더 분리.
