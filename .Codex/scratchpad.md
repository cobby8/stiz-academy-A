# STIZ Codex Scratchpad

## 현재 작업
- 작업명: 다크모드 글자 대비 전역 보정
- 상태: 구현 및 검증 완료, 커밋 준비 중
- 범위: `src/app/layout.tsx`, `src/app/globals.css`
- 기준일: 2026-07-12

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 전역 원인 조사 | 완료 | `body`에 다크모드 네온 라임 배경/남색 글자가 잘못 적용된 원인 확인 |
| 전역 기본색 보정 | 완료 | 다크모드 CSS 변수와 `color-scheme: dark` 추가 |
| 입력창 대비 보정 | 완료 | input/select/textarea 다크모드 배경, 글자, placeholder, border 보정 |
| 반복 hover 보정 | 완료 | gray/white/blue/orange hover가 다크모드에서 밝게 튀는 패턴 보정 |
| 검증 | 완료 | `npx.cmd tsc --noEmit`, `npm.cmd run build` 통과 |

## 작업 로그
- 2026-07-12: 다크모드 전역 글자 대비 문제를 조사해 `body`의 잘못된 `dark:bg-brand-neon-lime dark:text-brand-navy-900` 적용을 제거하고, 전역 CSS 안전망으로 기본 배경/글자/입력창/hover 대비를 보정했다. `npx.cmd tsc --noEmit`, `npm.cmd run build` 통과.
- 2026-07-12: `/admin/gallery` 첫 진입 체감을 위해 초기 데이터가 있으면 클라이언트 재 refresh를 생략하고, 갤러리 카드는 최초 12개만 렌더링한 뒤 더 보기로 점진 표시하도록 변경했다.
- 2026-07-12: 관리자 사이드바 백업/복원/시트 동기화 도구를 첫 진입에서 바로 로드하지 않고 시스템 도구 클릭 시 lazy chunk로 로드하도록 변경했다.
- 2026-07-12: Vercel Fluid Compute와 `icn1` region 설정을 적용해 관리자 함수 cold start와 DB 거리 비용을 줄였다.
- 2026-07-12: `/admin` 대시보드 primary payload의 여러 DB 호출을 통합 SQL 호출로 줄였다.
- 2026-07-11: 관리자 대시보드와 원생 목록의 초기 렌더링을 가볍게 만들기 위해 대시보드는 요약 먼저, 원생 목록은 최초 50명만 표시하도록 변경했다.
- 2026-07-11: `/admin/programs`, `/admin/schedule`, `/admin/students`, `/admin/classes`, `/admin/trial` 등 주요 관리자 페이지가 서버 캐시 payload를 초기에 주입받도록 정리했다.
- 2026-07-11: 관리자 공통 shell의 반복 API와 권한 확인 비용을 줄이기 위해 trial-count 자동 조회 제거, `getClaims()` 우선 인증, role 메모리 캐시를 적용했다.
- 2026-07-11: Google Sheets 시간표를 수동 동기화 + DB 캐시 방식으로 전환해 페이지 진입 시 외부 시트를 기다리지 않도록 했다.
- 2026-07-10: 여러 관리자 페이지의 DDL 보장 호출을 읽기 화면에서 제거하고, 실제 생성/수정 작업 시점으로 옮겼다.

## 구현 기록
- 변경 파일: `src/app/layout.tsx`, `src/app/globals.css`
- 주요 변경:
  - `body`의 다크모드 배경/글자 클래스를 selection 전용 클래스로 수정.
  - `.dark` 전역 CSS 변수로 정상적인 어두운 기본 배경/밝은 기본 글자색 지정.
  - 다크모드에서 입력창, 선택창, textarea가 검은 글자/밝은 배경으로 섞이지 않도록 공통 스타일 추가.
  - `hover:bg-gray-*`, `hover:bg-white`, `hover:bg-blue-50`, `hover:bg-brand-orange-50` 계열이 다크모드에서 밝게 튀지 않도록 보정.

## 테스트 결과
- `npx.cmd tsc --noEmit`: 통과
- `npm.cmd run build`: 통과
- 참고: 빌드 중 Supabase pooler 접속 경고가 출력됐지만 로컬 정적 페이지 데이터 생성 중 DB에 닿지 못하는 기존 경고이며 exit code 0으로 완료.

## 다음에 할 것
- 실제 브라우저 다크모드에서 관리자 주요 화면(`/admin`, `/admin/gallery`, `/admin/students`, `/admin/settings`)을 눈으로 확인한다.
- 남은 특정 컴포넌트 단위 대비 문제가 발견되면 전역 안전망이 아니라 해당 컴포넌트의 명시적 `dark:*` 클래스로 좁게 보정한다.
