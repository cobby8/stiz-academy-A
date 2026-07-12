# STIZ Codex Scratchpad

## 현재 작업
- 작업명: 홈페이지 기본 테마 다크모드 전환
- 상태: 구현 완료, 검증 중
- 범위: `src/app/layout.tsx`
- 기준일: 2026-07-12

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 테마 구조 확인 | 완료 | `next-themes` 기반 `ThemeProvider`에서 기본값 제어 확인 |
| 기본값 변경 | 완료 | `defaultTheme="system"`을 `defaultTheme="dark"`로 변경 |
| 사용자 선택 유지 확인 | 완료 | `next-themes` 저장값이 있으면 기존 사용자 선택을 우선 사용 |
| 검증 | 완료 | `npx.cmd tsc --noEmit` 통과 |

## 작업 로그
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
- 변경 파일: `src/app/layout.tsx`
- 주요 변경:
  - `ThemeProvider`의 기본 테마를 `dark`로 설정.
  - `enableSystem`은 유지해 기존 테마 처리와 향후 시스템 옵션 호환성을 보존.

## 테스트 결과
- `npx.cmd tsc --noEmit`: 통과

## 다음에 할 것
- 필요 시 실제 브라우저에서 첫 방문 기준 다크모드 진입을 확인한다.
