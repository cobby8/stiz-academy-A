# 코딩 규칙 및 스타일
<!-- 담당: developer, reviewer | 최대 30항목 -->
<!-- 이 프로젝트만의 코드 스타일, 네이밍 규칙, 패턴을 기록 -->

### [2026-08-05] 컴포넌트 파일 삭제 전에는 src/ 가 아니라 tests/ 를 grep 해야 한다
- **분류**: convention
- **발견자**: developer
- **내용**: 이 프로젝트의 회귀 테스트(`tests/*.test.mjs`, node --test)는 소스 파일을 `readFile("src/app/...")` 로 읽어 정규식 검사한다. 그래서 컴포넌트가 **import 참조 0건이어도** 테스트가 파일 경로를 문자열로 붙들고 있어, 삭제하는 순간 ENOENT 로 테스트 파일 전체가 죽는다. 실측: `ShuttleRouteAdminClient.tsx` 는 src/ 참조 0건이었지만 tests/ 7개 파일이 읽고 있었고, `EditApplicationModal` 도 `assert.match(applyModals, /function EditApplicationModal/)` 로 존재를 강제받고 있었다(신규 실패 9건 발생 → 원복). **죽은 코드 삭제 시 검색 범위는 `grep -rn "<심볼>" src/ tests/ scripts/` 로 잡는다.** 또 `npx vitest` 는 이 프로젝트 의존성이 아니라 실행하면 324개 전부 "no test suite" 로 오탐하니, 테스트는 `node --test tests/*.test.mjs` 로 돌린다.
- **참조횟수**: 0

### [2026-08-05] 라우트 파일을 지우면 .next/types/validator.ts 가 낡아 tsc 가 깨진다
- **분류**: convention
- **발견자**: developer
- **내용**: `src/app/**/page.tsx` 를 삭제하면 `npx tsc --noEmit` 이 `.next/types/validator.ts(...): Cannot find module '../../src/app/.../page.js'` 로 실패한다. 소스 문제가 아니라 **이전 빌드가 남긴 생성 타입이 낡은 것**이다. `npx next build` 로 재생성하면 사라진다. 즉 라우트 삭제 작업의 검증 순서는 tsc → build 가 아니라 **build → tsc** 다.
- **참조횟수**: 0

### [2026-03-22] 공개 페이지 서버 컴포넌트 데이터 조회 패턴
- **분류**: convention
- **발견자**: reviewer
- **내용**: 공개 페이지(schedule, simulator 등)는 Promise.all로 5개 쿼리(getAcademySettings, getSheetSlotCache, getClassSlotOverrides, getCustomClassSlots, getPrograms)를 병렬 실행 후, overrideMap + sheetMerged + customMerged 순서로 MergedSlot[]을 조합한다. revalidate=300 (5분 ISR).
- **참조횟수**: 0

### [2026-03-22] 관리자 페이지 Suspense 분리 패턴
- **분류**: convention
- **발견자**: reviewer
- **내용**: admin 대시보드는 빠른 쿼리(DB 카운트 등)와 느린 쿼리(Supabase Storage, 경영통계 등)를 Suspense 경계로 분리한다. 느린 섹션은 별도 async 서버 컴포넌트로 만들어 스켈레톤 fallback을 제공한다.
- **참조횟수**: 0

### [2026-03-22] 클라이언트 필터링 useMemo 패턴
- **분류**: convention
- **발견자**: reviewer
- **내용**: 서버에서 전체 데이터를 받아 클라이언트에서 필터링할 때는 useMemo로 감싸서 의존성 배열(선택된 필터값들)이 변경될 때만 재계산한다. (SimulatorClient, ScheduleClient 참고)
- **참조횟수**: 0

### [2026-03-26] lucide-react 아이콘 사용 잔존 (conventions 위반)
- **분류**: convention
- **발견자**: planner-architect
- **내용**: CLAUDE.md에서 "Material Symbols Outlined 아이콘 사용, lucide-react 등 타 라이브러리 금지"로 규정되어 있으나, gallery/GalleryPublicClient.tsx (X, ChevronLeft, ChevronRight, Image, Play, Calendar)와 notices/page.tsx (Pin, Paperclip)에서 lucide-react를 여전히 사용 중. 교체 필요.
- **참조횟수**: 0

### [2026-03-28] 네비게이션 메뉴 4카테고리 구조
- **분류**: convention
- **발견자**: pm (사용자 지시)
- **내용**: 헤더 메뉴는 4개 상위 항목으로 구성. (1) 학원 소개 — /about 직접 링크, 드롭다운 없음. (2) 수업 안내 ▾ — 프로그램, 시간표, 연간일정. (3) 소식/안내 ▾ — 공지, 갤러리, FAQ(/faq), 이용약관(/terms). (4) 수업찾기 — /simulator 직접 링크. CTA 버튼은 "신청하기"(/apply).
- **참조횟수**: 0

### [2026-03-27] 체험수업 비용 표기 규칙
- **분류**: convention
- **발견자**: pm (사용자 지시)
- **내용**: 체험수업은 무료가 아니라 **1회 1만원의 체험비**가 있다. "무료 체험", "체험수업은 무료" 등의 표현은 절대 사용하지 않는다. 올바른 표현: "체험비 1만원", "체험수업 1회 1만원". FAQ, 배지, 투어 안내, 관리자 플레이스홀더 등 모든 곳에서 동일 적용.
- **참조횟수**: 0

### [2026-07-26] 확정(스냅샷) 데이터의 상태 판단은 데이터 자체로 한다
- **분류**: convention
- **발견자**: developer
- **내용**: 방학특강 셔틀 확정 명단처럼 "확정 전=원본 폴백 / 확정 후=스냅샷"인 구조에서는, 화면·API가 별도 확정 플래그를 들고 다니지 않는다. 행마다 `origin: "CONFIRMED"|"FALLBACK"` 과 `rosterId`를 실어 보내고, 화면은 `rows.some(r => r.origin === "CONFIRMED")`로 판단하며, 저장도 `rosterId ? {rosterId,patch} : {requestId,patch}`로 행 단위로 갈린다. 플래그를 따로 두면 명단과 플래그가 다른 출처에서 와서 어긋나는 순간이 반드시 생긴다. 또한 게이트웨이(`src/lib/seasonal/shuttleRoster.ts`)의 "명단을 읽는 export 함수는 get* 딱 2개"는 회귀 테스트로 고정돼 있으므로, 부가 메타 조회는 `get`으로 시작하지 않는 이름(`shuttleRosterConfirmationInfo`)을 쓴다.
- **참조횟수**: 0

### [2026-07-26] 상태 전이(확정·마감·잠금)의 갈림길은 서버가 판단한다
- **분류**: convention
- **발견자**: reviewer
- **내용**: "확정 전 → 원본 수정 / 확정 후 → 스냅샷 수정"처럼 상태에 따라 쓰기 대상이 바뀌는 API는, **클라이언트가 보낸 키(rosterId 유무 등)만 보고 갈라서는 안 된다.** 클라이언트 상태는 항상 낡을 수 있다(탭을 열어둔 채 다른 사람이 확정). 서버가 현재 상태를 직접 확인하고, 낡은 요청은 **성공시키지 말고 409로 거절**해야 한다("명단이 확정되었습니다. 새로고침 후 다시 시도해주세요"). 조용히 옛 경로로 저장하면 사용자는 "저장됨"을 보고 실제로는 아무 데도 반영되지 않는다 — 가장 알아채기 어려운 사고 유형이다. 같은 이유로 `UPDATE … WHERE id=$1`의 영향 행 수(`changed`)가 0이면 ok로 응답하지 않는다.
- **참조횟수**: 0

### [2026-07-26] 소스 문자열 매칭 테스트의 한계선
- **분류**: convention
- **발견자**: reviewer
- **내용**: 이 프로젝트의 회귀 테스트는 대부분 소스 파일을 읽어 정규식으로 검사한다(DB·로그인 벽 때문). 이 방식이 **유효한 대상**은 "이 문자열이 있으면 안 된다"류의 구조 불변식이다(예: 확정본 편집 구역에 원본 테이블 이름 미등장, 모든 `UPDATE`가 같은 테이블, CSV 파일명, 안전장치 토글 존재). **무효한 대상**은 실제 동작이다 — SQL 파라미터 번호 어긋남, SET 절 중복 컬럼, 분기 조건의 논리 오류는 문자열로 절대 잡히지 않는다. 동작을 지켜야 하면 순수 함수로 분리해 export 하고 "입력 → 생성된 SQL/args" 를 단언한다. 또한 `row.rosterId ? { … } : { … }` 같은 **표현식 원문을 통째로 고정**하거나 애초에 존재한 적 없는 문자열의 부재를 단언하는 검사는 리팩터링만 방해하므로 쓰지 않는다.
- **참조횟수**: 0

### [2026-03-29] Server Action 인증 가드 패턴
- **분류**: convention
- **발견자**: reviewer
- **내용**: 모든 관리자 전용 Server Action 함수는 첫 줄에 `await requireAdmin()`을 호출한다. 인증 가드 파일(auth-guard.ts)은 `"use server"` 지시자 없이 순수 서버 유틸리티로 유지한다. 학부모도 사용할 함수(알림 읽음, 요청 접수 등)는 향후 `requireAuth()`로 변경 필요.
- **참조횟수**: 0

### [2026-08-06] 에이전트를 병렬로 돌릴 때 git stash 를 쓰면 남의 작업이 사라진다
- **분류**: convention
- **발견자**: pm
- **내용**: `git stash` 는 **워킹트리 전체**를 대상으로 한다. 여러 에이전트가 동시에 서로 다른 파일을 고치는 중에 한 에이전트가 "테스트 기준선을 재려고" stash 를 실행하면, **다른 에이전트의 미저장 변경까지 전부 치워진다.** 실측(2026-08-06): 문구 정리 5개 병렬 작업 중 한 에이전트의 `git stash push -- src/` 가 46개 파일을 치웠고, 그 사이 다른 에이전트가 같은 파일을 새로 써서 `git stash pop` 이 충돌로 실패했다. 파일 단위 수동 복원으로 유실 0건에 그쳤지만 복구에 많은 시간이 들었다. **기준선이 필요하면 stash 대신 `git show HEAD:<파일>` 로 개별 조회한다.** PM 은 병렬 위임 프롬프트에 stash 금지를 명시하고, 커밋 직전 `git status` 로 예상 파일 수를 대조한다. 또 작업이 끝난 뒤 `git stash list` 를 확인해 남은 stash 를 정리한다 — 남겨 두면 나중에 pop 했을 때 최신 작업을 옛 버전으로 덮어쓴다.
- **참조횟수**: 0
