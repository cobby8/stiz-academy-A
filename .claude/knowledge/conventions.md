# 코딩 규칙 및 스타일
<!-- 담당: developer, reviewer | 최대 30항목 -->
<!-- 이 프로젝트만의 코드 스타일, 네이밍 규칙, 패턴을 기록 -->

### [2026-08-08] 인앱 브라우저(카카오톡 등)에서는 PWA 설치가 원천 불가 — 판별은 순수 모듈 한 곳에서
- **분류**: convention
- **발견자**: developer
- **내용**: 학부모가 카카오톡·문자 링크를 누르면 **인앱 브라우저**로 열려 홈 화면 추가가 아예 불가능하다. 판별 로직은 `src/lib/pwa/installEnvironment.ts`(의존성 0, 순수 함수) 한 곳에만 두고 `/app`·`/staff/install` 두 화면이 공유한다 — 화면이 UA 정규식을 각자 들고 있으면 한쪽만 고쳐지는 사고가 난다(테스트가 `iphone|ipad|ipod` 재등장을 금지). 판별 원칙은 **확실한 표식만**(KAKAOTALK / NAVER(inapp / Instagram / FBAN·FBAV / Line/ / 안드로이드 `; wv)` / iOS인데 UA에 Safari 토큰 없음) — 오탐이 미탐보다 나쁘다. 함정: **라인 iOS UA에는 `Safari` 토큰이 있어** 인앱 판정을 먼저 하지 않으면 ios-safari 로 오판한다(`isIosSafari` 는 `inAppBrowser === null` 을 반드시 포함). 탈출 경로는 카카오톡만 스킴이 있다(`kakaotalk://web/openExternal?url=<encodeURIComponent>`), 나머지는 ⋯메뉴 안내 + **주소 복사**(clipboard 실패 시 주소를 화면에 노출해 길게 눌러 복사)를 최후 수단으로 항상 붙인다. UA 판별은 문자열 매칭 테스트로 못 잡으므로 `tests/pwa-install-environment.test.mjs` 처럼 **typescript.transpileModule 로 실제 실행**해 실제 UA 문자열로 단언한다.
- **참조횟수**: 0

### [2026-08-08] 브라우저가 "한 번만" 쏘는 이벤트는 useEffect로 못 잡는다 — head 인라인 스크립트로 선점
- **분류**: convention
- **내용**: `beforeinstallprompt`(PWA 설치)처럼 **페이지 로드 직후 한 번만 발생하고 재발화하지 않는** 이벤트는, React 하이드레이션 → `useEffect` 순서가 그보다 늦어 **조용히 유실**된다(설치 버튼이 영영 안 뜸). 해결 패턴: `src/app/layout.tsx` `<head>`에 인라인 스크립트를 넣어 React보다 먼저 리스너를 달고 `window.__stizInstallPrompt` 에 보관 + `stiz:installprompt` / `stiz:installed` 커스텀 이벤트로 알린다. 화면 컴포넌트는 마운트 시 **① 전역 보관값 먼저 확인 → ② 커스텀 이벤트 구독 → ③ 원본 이벤트 직접 구독(늦게 오는 경우 대비)** 3중으로 받는다. 스크립트는 `__stizInstallPromptReady` 가드로 중복 등록을 막고 전체를 try/catch로 감싼다(레이아웃은 사이트 전체에 영향). 이 프로젝트엔 CSP 가 없어 인라인 스크립트가 허용된다. 회귀 방지: 전역 변수명·이벤트명이 어긋나면 조용히 다시 버튼이 사라지므로, `tests/pwa-install-prompt-capture.test.mjs` 에서 layout.tsx 의 스크립트 원문을 정규식으로 추출해 **가짜 window(EventTarget)에 실제 실행**시켜 동작을 단언한다(문자열 매칭만으로는 동작을 못 잡는다).
- **참조횟수**: 0

### [2026-08-08] 기기 판별(UA)과 기능 가용성은 절대 같은 상태로 합치지 않는다
- **분류**: convention
- **내용**: 설치 화면이 `beforeinstallprompt` 를 받자마자 `setDeviceState("android")` 를 실행해, **PC 크롬에서도 안드로이드 안내가 나오고** 반대로 PC는 설치 버튼을 못 받는 버그가 있었다. 원인은 "기기가 무엇인가"(UA로 판별, 안내 문구용)와 "지금 설치할 수 있는가"(프롬프트 존재 여부, 버튼 노출용)를 한 변수에 욱여넣은 것. **두 상태를 분리하고 버튼은 `installPrompt` 만 보고, 문구는 `deviceState` 만 본다.** 또 브라우저는 **이미 설치돼 있으면 `beforeinstallprompt` 를 아예 쏘지 않으므로**, 프롬프트가 없는 안드로이드/PC 문구에는 "이미 설치돼 있으면 설치 버튼이 나타나지 않습니다" 한 줄을 붙여 "고장났다"는 오해를 막는다. iOS 는 프로그램적 설치 API 자체가 없어 공유→홈 화면에 추가 3단계 안내가 유일한 경로다(제거 금지).
- **참조횟수**: 0

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

### [2026-08-06] 확정본을 화면에 쓸 때는 "폴백"과 "미반영분"을 항상 같이 붙인다
- **분류**: convention
- **발견자**: developer
- **내용**: 저장된 확정 노선/명단을 화면 소스로 승격할 때, 두 가지를 반드시 함께 만든다. (1) **폴백**: 저장본이 없거나 비어 있으면 종전 소스로 되돌아가고, 화면에 `임시 순서 · 확정 전` 같은 짧은 표시를 단다. 저장본을 무조건 쓰면 아직 저장 안 한 요일에 화면이 통째로 빈다. (2) **미반영분 노출**: 원본에는 있는데 확정본에 없는 대상은 지우지 말고 `⚠️ 노선에 없는 승객` 같은 별도 섹션으로 뒤에 붙인다. 이 프로젝트의 과거 사고는 전부 "조용히 사라짐/조용히 어긋남"이었다. 판정 로직(`pickRegularRouteSource` 등)은 순수 함수로 떼어 `tests/*.test.mjs` 로 못박는다 — DB 없이 회귀를 잡을 수 있는 유일한 지점이다.
- **참조횟수**: 0

### [2026-08-08] 브라우저 안내 문구는 "실제 메뉴 이름 그대로" + 판별은 좁은 토큰부터
- **분류**: convention
- **발견자**: developer
- **내용**: PWA 설치 안내처럼 사용자가 브라우저 메뉴를 직접 찾아야 하는 안내는, 비슷한 말로 바꾸면 그 항목을 못 찾고 그대로 이탈한다. 실측(2026-08-08): "브라우저 메뉴에서 '앱 설치'" 라고 안내했으나 갤럭시 기본 브라우저인 **삼성 인터넷의 실제 메뉴는 "우측 하단 ≡ → 현재 페이지 추가 → 홈 화면"** 이라 학부모가 포기했다. 안내 문구는 브라우저별로 갈라 **메뉴에 적힌 문자열 그대로** 쓴다. 또한 UA 판별은 **좁은 토큰을 먼저** 본다 — 삼성 인터넷 UA 에는 `SamsungBrowser` `Chrome` `Safari` 토큰이 전부 들어 있어(`... SamsungBrowser/21.0 Chrome/110... Mobile Safari/537.36`), Chrome 을 먼저 보면 크롬으로 오판한다. 판별과 문구 생성은 `src/lib/pwa/installEnvironment.ts` 같은 **의존성 없는 순수 모듈**에 두고 실제 UA 문자열로 실행 검증한다(소스 문자열 매칭으론 정규식 순서 오류를 못 잡는다). 화면(클라이언트 컴포넌트)이 메뉴 이름을 직접 들고 있으면 한쪽 화면만 고쳐지므로, 공용 컴포넌트로 빼고 "화면 소스에 메뉴 이름이 없어야 한다"를 테스트로 못박는다.
- **참조횟수**: 0

### [2026-08-08] 설치 안내 화면은 "설치 전용" — 앱 진입 버튼을 섞지 않는다, prompt() 자동 호출 금지
- **분류**: convention
- **발견자**: developer
- **내용**: PWA 설치 안내 화면(`/app`·`/staff/install`)에 "마이페이지 열기"·"선생님 앱 열기" 같은 진입 버튼을 함께 두면, 사용자가 설치 대신 그 버튼을 눌러 버려 설치율이 오르지 않는다. 설치 화면의 주 행동은 **설치 버튼 하나뿐**이어야 하고 스크롤 없이 첫 화면에 보여야 한다(기능 소개 타일·가입 안내 카드 등 부가 섹션 제거). 다만 `설치하지 않아도 웹에서 바로 사용할 수 있습니다.` 한 줄은 설치 불가 사용자의 유일한 대안이라 반드시 남긴다. 또한 **`beforeinstallprompt` 의 `prompt()` 는 사용자 제스처(user activation) 안에서만 호출 가능**하다 — "클릭 없이 자동 설치"를 만들려고 로드 직후 호출하면 크롬·삼성 인터넷 모두 차단하고 그 프롬프트가 무효화돼 이후 버튼을 눌러도 설치가 안 된다. 목표는 "완전 자동"이 아니라 **"탭 한 번"** 으로 줄이는 것. 프롬프트가 없으면 기기별 수동 단계를 대신 보여준다.
- **참조횟수**: 0

### [2026-08-08] 안드로이드 탈출·설치는 intent:// 로 크롬을 지정한다 (iOS는 렌더 금지)
- **분류**: convention
- **발견자**: developer
- **내용**: 안드로이드에서 (1) 카카오톡 등 **인앱 브라우저**는 홈 화면 추가가 막히고, (2) **삼성 인터넷**으로 설치한 WebAPK 는 Google Play 프로텍트가 "안전하지 않은 앱"으로 차단한다(브라우저가 만드는 파일이라 우리가 못 고침). 둘 다 **크롬으로 열면 해결**된다 — 크롬은 구글 서버에서 WebAPK 를 받아온다. 형식: `intent://<host><path><search>#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=<encodeURIComponent(원래 https 주소)>;end`. **`S.browser_fallback_url` 은 필수** — 크롬이 없는 기기에서 인텐트가 실패하면 빈 화면이 된다. 생성 함수(`buildChromeIntentUrl`)는 순수 함수로 두고 **https 가 아니면 `null`** 을 반환해 잘못된 인텐트를 만들지 않는다(개발 http·`javascript:` 방어). **intent 스킴은 iOS 에서 동작하지 않으므로 버튼 자체를 렌더하지 않는다**(`shouldOfferChromeIntent(platform)` 로 게이트) — 눌러도 아무 일 없는 버튼이 더 나쁘다. iOS 는 기존 `kakaotalk://web/openExternal` 경로 유지. 인텐트가 막히는 기기가 있으므로 메뉴 안내·주소 복사는 **보조로 항상 남긴다**. 🚫 보안 경고를 "무시하고 설치하라"는 안내는 절대 넣지 않는다(진짜 악성 앱도 그렇게 설치하게 된다).
- **참조횟수**: 0

### [2026-08-08] 크롬 메뉴 이름은 버전마다 다르다 — UA로 가르지 말고 두 이름을 나란히 적는다
- **분류**: convention
- **발견자**: developer
- **내용**: 실기기 확인(2026-08-08, 갤럭시 크롬): ⋮ 메뉴 항목이 **"설치 및 바로가기 만들기"** 였는데 안내는 "‘앱 설치’ 또는 ‘홈 화면에 추가’" 라서 학부모가 그 항목을 못 찾았다(삼성 인터넷 때와 동일한 유형의 사고, 2회째). 크롬 **버전 경계가 불확실**해 UA 로 갈라 문구를 고르면 오히려 틀린 안내가 나간다. 해결은 **두 표기를 나란히** 적는 것: `‘설치 및 바로가기 만들기’·‘앱 설치’`. 단계 라벨에는 길이 상한(24자) 테스트가 걸려 있으므로 "또는" 대신 가운뎃점(`·`)으로 붙여 길이를 줄인다. 문구 변경 시 `tests/pwa-install-environment.test.mjs` 에 두 이름이 모두 포함되는지 단언을 함께 추가한다.
- **참조횟수**: 0
