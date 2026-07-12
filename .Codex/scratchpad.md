# STIZ Codex Scratchpad

## 현재 작업
- 작업명: 사이트/관리자 다크모드 대비 전수 보정
- 상태: 구현 완료, 검증 완료
- 범위: 전역 다크모드 배경/칩/뱃지/보조 텍스트 대비 안전망
- 기준일: 2026-07-12

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 전수 검색 | 완료 | `src/app`, `src/components`의 밝은 배경/컬러 칩/뱃지/텍스트 패턴 확인 |
| 전역 보정 | 완료 | `bg-surface-*`, pastel `bg-*-50/100`, slash opacity 칩, 컬러 텍스트/테두리 보정 |
| 회색 보조 텍스트 | 완료 | `text-gray-500` 누락 영역은 다크모드에서 `gray-400`으로 보정 |
| 브라우저 확인 | 완료 | Playwright + 로컬 Chrome으로 대표 페이지와 위험 패턴 fixture 색상 확인 |
| 검증 | 완료 | `npx.cmd tsc --noEmit`, `npm.cmd run build` 통과 |

## 작업 로그
- 2026-07-12: 사이트/관리자 전역 다크모드 대비를 전수 점검해 `bg-surface-warm/section`, pastel 칩/뱃지, slash opacity 배경, 컬러 텍스트/테두리, `text-gray-500` 누락을 `globals.css` 안전망으로 보정했다.
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
- 변경 파일: `src/app/globals.css`
- 주요 변경:
  - 다크모드에서 `bg-surface-warm`, `bg-surface-section`이 밝은 바탕으로 남지 않도록 보정.
  - `bg-orange-50`, `bg-blue-50/70`, `bg-green-100`처럼 칩/뱃지에 쓰는 밝은 pastel 배경을 어두운 색으로 변환.
  - `text-orange-700`, `text-green-700/70` 같은 상태 텍스트를 다크모드용 밝은 색으로 보정.
  - 밝은 상태 테두리와 hover 배경도 함께 보정.

## 테스트 결과
- `npx.cmd tsc --noEmit`: 통과
- Playwright + 로컬 Chrome 색상 fixture 검사: 통과
- `npm.cmd run build`: 통과 (로컬 Supabase pooler 접속 경고는 기존 fallback으로 흡수, exit 0)

## 다음에 할 것
- 로그인 세션이 있는 실제 관리자/선생님 화면에서 눈에 띄는 잔여 대비 이슈가 보이면 해당 컴포넌트별 명시 `dark:*` 클래스로 추가 보강한다.
