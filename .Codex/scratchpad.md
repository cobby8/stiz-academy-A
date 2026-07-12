# STIZ Codex Scratchpad

## 현재 작업
- 작업명: 사이트 운영 점검 봇 새벽 자동 실행
- 상태: 구현 완료, 검증 완료
- 범위: Vercel Cron, cron 전용 API, 사이트 운영 점검 봇 자동 실행
- 기준일: 2026-07-12

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| cron API | 완료 | `GET /api/cron/site-ops-bot` 추가, `CRON_SECRET` 인증 적용 |
| 실행 시간 | 완료 | Vercel cron `0 17 * * *` 등록, KST 새벽 2시 실행 |
| 공용 실행 함수 | 완료 | 관리자 수동 실행과 cron 실행이 같은 `runSiteOpsBot` 로직을 사용 |
| 속도 보호 | 완료 | 관리자 첫 진입 자동 실행은 여전히 없음 |
| 검증 | 완료 | `tsc --noEmit`, `npm run build` 통과 |

## 작업 로그
- 2026-07-12: 사이트 운영 점검 봇을 매일 KST 새벽 2시에 백그라운드 실행하도록 `/api/cron/site-ops-bot`와 Vercel cron `0 17 * * *`를 추가했다. 기존 관리자 수동 실행은 유지하고, cron도 같은 점검/자동조치/관리자 알림 로직을 사용한다.
- 2026-07-12: `/admin` 첫 진입 탭을 사이트로 바꾸고, 대시보드에 사이트 점검 봇 수동 실행 카드를 추가했다. 점검 봇은 DB/기본 설정/콘텐츠/시간표/신청 링크/백업/인스타 상태를 확인하고, 안전한 항목은 자동 조치하며 수동 확인 항목은 관리자 알림으로 남긴다.
- 2026-07-12: 관리자 속도 추가 점검으로 원생 자동 전체 재조회 제거, 체험/수강신청 점진 렌더링, 원생 상태 계산 캐시, 관리자 조회용 DB 인덱스/SQL 파일을 추가했다. live DB push는 별도 명시 승인 필요.
- 2026-07-12: 홈페이지 첫 방문 기본 테마를 `system`에서 `dark`로 변경했다. 저장된 사용자 선택이 없는 경우 다크모드로 시작하고, 사용자가 토글로 바꾼 선택은 유지된다.
- 2026-07-12: 다크모드 전역 글자 대비 문제를 조사해 `body`의 잘못된 `dark:bg-brand-neon-lime dark:text-brand-navy-900` 적용을 제거하고, 전역 CSS 안전망으로 기본 배경/글자/입력창/hover 대비를 보정했다. `npx.cmd tsc --noEmit`, `npm.cmd run build` 통과.
- 2026-07-12: `/admin/gallery` 첫 진입 체감을 위해 초기 데이터가 있으면 클라이언트 재 refresh를 생략하고, 갤러리 카드는 최초 12개만 렌더링한 뒤 더 보기로 점진 표시하도록 변경했다.
- 2026-07-12: 관리자 사이드바 백업/복원/시트 동기화 도구를 첫 진입에서 바로 로드하지 않고 시스템 도구 클릭 시 lazy chunk로 로드하도록 변경했다.
- 2026-07-12: Vercel Fluid Compute와 `icn1` region 설정을 적용해 관리자 함수 cold start와 DB 거리 비용을 줄였다.
- 2026-07-12: `/admin` 대시보드 primary payload의 여러 DB 호출을 통합 SQL 호출로 줄였다.
- 2026-07-11: 관리자 대시보드와 원생 목록의 초기 렌더링을 가볍게 만들기 위해 대시보드는 요약 먼저, 원생 목록은 최초 50명만 표시하도록 변경했다.
- 2026-07-11: `/admin/programs`, `/admin/schedule`, `/admin/students`, `/admin/classes`, `/admin/trial` 등 주요 관리자 페이지가 서버 캐시 payload를 초기에 주입받도록 정리했다.
- 2026-07-11: 관리자 공통 shell의 반복 API와 권한 확인 비용을 줄이기 위해 trial-count 자동 조회 제거, `getClaims()` 우선 인증, role 메모리 캐시를 적용했다.
- 2026-07-11: Google Sheets 시간표를 수동 동기화 + DB 캐시 방식으로 전환해 페이지 진입 시 외부 시트를 기다리지 않도록 했다.

## 구현 기록
- 변경 파일: `src/app/api/cron/site-ops-bot/route.ts`, `src/lib/siteOpsBot.ts`, `vercel.json`
- 주요 변경:
  - cron 전용 `GET /api/cron/site-ops-bot` 추가.
  - 운영 환경에서는 `Authorization: Bearer ${CRON_SECRET}` 없으면 거부.
  - Vercel cron에 매일 UTC 17:00 실행 등록. 한국 시간으로 다음 날 새벽 2시.
  - `runSiteOpsBot`을 관리자 수동 실행과 cron 실행에서 공용으로 사용하도록 인자를 선택값으로 변경.

## 테스트 결과
- `npx.cmd tsc --noEmit`: 통과
- `vercel.json` JSON parse: 통과
- `npm.cmd run build`: 통과 (로컬 Supabase pooler 접속 경고는 기존 fallback으로 흡수, exit 0)

## 다음에 할 것
- 배포 후 Vercel Cron 로그에서 `/api/cron/site-ops-bot`가 KST 새벽 2시에 실행되는지 확인한다.
