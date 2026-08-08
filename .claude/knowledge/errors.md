# 에러 및 함정 모음
<!-- 담당: debugger, tester | 최대 30항목 -->
<!-- 이 프로젝트에서 반복되는 에러 패턴, 함정, 주의사항을 기록 -->

### [2026-07-26] 읽기만 게이트웨이로 옮기고 쓰기는 원본에 남겨 두면 "조용한 no-op"이 된다
- **분류**: error
- **발견자**: tester
- **내용**: 셔틀 대상자 **조회**는 `getConfirmedShuttleRoster` 게이트웨이(확정본 우선)로 일원화했는데, **저장**은 화면마다 제각각 원본 테이블(`SpecialProgramShuttleRequest`)에 남아 있었다. 확정 전에는 조회=원본이라 아무 문제가 없어 테스트도 통과한다. **확정 버튼을 누르는 순간** 조회가 확정본으로 바뀌면서, 원본에 쓰는 화면은 "저장했습니다" 토스트를 띄우고 목록을 새로고침해도 값이 그대로다 — 에러도 로그도 없이 조용히 무시된다(가장 늦게 발견되는 종류의 사고). 실제 사례: `/admin/seasonal/shuttle`은 확정본 저장 경로를 추가해 해결했으나, 같은 데이터를 다루는 `/admin/shuttle`(노선 편성)의 "위치 확정"(`updateShuttleRequestLocation`)은 누락돼 확정 후 핀 편집이 먹지 않는다.
- **탐지 방법**: `grep -rln "<원본테이블명>" src/` 로 나온 파일과 게이트웨이 소비처 목록을 **대조**한다. 원본 테이블에 UPDATE를 하는 파일이 게이트웨이 소비처 목록에도 있으면 = 그 화면은 "확정본을 읽고 원본에 쓴다" = 확정 후 깨진다.
- **예방법**: 읽기 게이트웨이를 만들 때 **쓰기 게이트웨이를 같은 커밋에서 함께** 만든다. 폴백 구조(확정 전=원본/확정 후=확정본)를 도입하면 **모든 쓰기 경로도 같은 분기를 타야** 한다. 분기를 못 넣으면 최소한 확정 후 409로 거절해 "조용히 무시" 대신 "명시적 실패"로 만든다.
- **참조횟수**: 0

### [2026-03-26] CSS box-shadow 스포트라이트 + 오버레이 배경 겹침 버그
- **분류**: error
- **발견자**: debugger
- **내용**: box-shadow로 스포트라이트 구멍을 뚫는 패턴에서, 오버레이 배경(rgba)과 box-shadow(rgba)가 동시에 적용되면 구멍이 보이지 않는다. 오버레이 배경이 구멍 위를 덮어버리기 때문. 해결: 스포트라이트(rect)가 활성화된 상태에서는 오버레이 배경을 transparent로 설정하고, box-shadow만으로 어둡게 처리한다. rect가 없는 초기 상태에서만 오버레이 배경색을 사용한다.
- **참조횟수**: 1

### [2026-03-26] CSS 기반 하이라이트의 근본적 한계 (5회 실패 종합)
- **분류**: error
- **발견자**: planner-architect
- **내용**: CSS만으로 특정 DOM 요소를 하이라이트하는 모든 방식이 실패한 종합 기록. (1) box-shadow 9999px 방식: 오버레이 배경과 겹침. (2) 대상 z-index 올리기: 부모 stacking context(sticky header, overflow:hidden 등)에 갇혀서 z-index가 무시됨. (3) 4-div 오버레이(상/하/좌/우 div로 구멍 생성): 대상이 뷰포트보다 크면 구멍이 전체를 차지. (4) 하이라이트 링(테두리만 표시): 시각적으로 "하이라이트" 느낌이 약함. 결론: 웹에서 안정적인 요소 하이라이트는 SVG mask/clipPath 방식(driver.js 등)이 유일하게 신뢰할 수 있음.
- **참조횟수**: 0

### [2026-03-29] Next.js 16 middleware.ts와 proxy.ts 충돌
- **분류**: error
- **발견자**: debugger
- **내용**: Next.js 16에서는 `middleware` 파일 컨벤션이 deprecated되고 `proxy`로 대체되었다. `src/middleware.ts`와 `src/proxy.ts`가 동시에 존재하면 개발서버 시작 시 `Unhandled Rejection: Both middleware file and proxy file are detected` 에러가 발생한다. 해결: `middleware.ts`를 삭제하고 `proxy.ts`만 사용한다. 새 matcher가 필요하면 `proxy.ts`의 config.matcher에 추가한다.
- **참조횟수**: 0

### [2026-07-06] isomorphic-dompurify(jsdom)가 Vercel 서버런타임에서 500 (ERR_REQUIRE_ESM)
- **분류**: error
- **발견자**: debugger
- **내용**: `@/lib/sanitize`의 `sanitizeHtml`은 `isomorphic-dompurify`를 쓰는데, 이 라이브러리는 서버에서 `jsdom`을 끌어온다. jsdom의 전이 의존성 `html-encoding-sniffer → @exodus/bytes/encoding-lite.js`가 ESM 전용 모듈이라, Vercel 서버리스(Next 16 Turbopack)가 이를 `require()`할 때 `Error [ERR_REQUIRE_ESM]`로 터진다. 에러는 **모듈 평가(import) 시점**에 발생하므로, `sanitize`를 import한 서버 컴포넌트 라우트의 서버 청크 로딩 자체가 실패 → 공지 내용과 무관하게 그 라우트 전체가 500. 커밋 dadb81e가 `/notices/[id]`에 `toNoticeHtml`(내부에서 sanitizeHtml 호출)을 추가하면서 이 동적 라우트가 매 요청 500이 됨(이전엔 sanitize를 안 써서 정상). 참고로 정적 라우트(/, /about, /apply)도 같은 에러를 내지만 빌드 프리렌더 캐시로 사용자에겐 잠재화되어 있었고, 동적 라우트 `/notices/[id]`만 사용자에게 500 노출.
- **해결(즉시)**: `src/lib/noticeContent.ts`의 `toNoticeHtml`은 이미 모든 사용자 텍스트를 `escapeHtml`로 이스케이프하고 화이트리스트 `<a>` 태그만 삽입하므로 출력이 이미 안전하다. 마지막 `return sanitizeHtml(out)`을 `return out`으로 바꾸고 sanitize import를 제거하면 jsdom 의존이 사라져 500 해소.
- **해결(근본)**: 사이트 전역에서 서버측 sanitize가 깨진 상태(ISR 재검증 실패로 stale 누적). isomorphic-dompurify를 jsdom 비의존 새니타이저로 교체하거나 서버 번들 설정을 조정하는 별도 작업 필요.
- **참조횟수**: 0

### [2026-07-26] T맵 경유지최적화가 항상 400(9401)으로 실패 → 노선이 늘 '직선 추정'
- **분류**: error
- **발견자**: pm
- **내용**: `src/lib/shuttle/tmap.ts`의 `optimizeWaypointOrderWithTmap`이 T맵 routeOptimization API를 호출하는데 두 가지 필수 조건을 어겨 **항상 400(code 9401 "필수 파라메터가 없습니다")**를 받고, `planRun`의 try/catch가 이를 삼켜 조용히 LOCAL(직선 추정) 폴백. 그래서 유효한 `TMAP_APP_KEY`가 있어도 "T맵 최적경로"가 절대 활성화되지 않았다. 실측 진단(실 키로 API 직접 호출): ①`startTime`(yyyyMMddHHmm)이 **필수** — 빼면 400, 넣으면 200. ②`viaPointId "0"`을 T맵이 **값 없음으로 취급** — 호출부(shuttle-optimize)가 `String(i)`로 0부터 매기면 첫 경유지가 "0"이라 항상 400. `carType`은 불필요(넣어도 무관), `searchOption`도 무관. 기본 자동차경로/POI API는 같은 키로 200이라 키·권한 문제 아님.
- **해결**: tmap.ts에서 (1) 요청 본문에 `startTime: tmapStartTime()`(현재 시각 Asia/Seoul) 추가, (2) 호출부 id를 그대로 보내지 말고 내부 안전 id(`wp0`,`wp1`…)로 바꿔 전송한 뒤 응답 순서를 원래 id로 되돌린다(originalBySafe 맵). 호출부 계약(id 넣고 순서 받기)은 그대로. 회귀 테스트 `tmap-route-optimization.test.mjs`에 startTime 형식·viaPointId≠"0" 단언 추가.
- **참조횟수**: 0

### [2026-08-09] scope 없는 manifest 하나가 같은 도메인의 다른 PWA 설치를 전부 막는다

**증상**: 갤럭시 크롬에서 `/mypage/install` 을 열면 설치 버튼 대신 "앱이 이미
설치되어 있습니다" 가 뜬다. 학부모 앱을 지워도 그대로. "앱 열기" 를 누르면 홈이
아니라 **설치 안내 화면이 앱 창으로** 열리고, 주소창·뒤로가기가 없어 갇힌다.

**원인**: `public/manifest.json` 에 `scope` 가 없었다. 없으면 기본값이 start_url
기준 `/` 라서, 공식 앱이 **사이트 전체를 자기 영역으로** 잡는다. 크롬은 현재
주소를 품는 설치된 앱을 찾으면(FindAppWithUrlInScope) manifest 의 `id` 가 달라도
"이미 설치됨" 으로 답한다. 즉 공식 앱이 깔린 기기에서는 `/staff`·`/mypage` 앱을
설치할 수 없다.

**확인법**: 공식 앱을 지우고 새로고침 → 설치 버튼이 즉시 나타나면 이 원인이다.

**해결**: 공식 앱을 설치 대상에서 제외(`display: "browser"`) + `scope` 명시.
같은 도메인에 역할별 PWA 를 둘 이상 두려면 **넓은 scope 앱을 만들지 않는다.**

**교훈**: manifest 의 빠진 필드는 "없음" 이 아니라 **기본값이 들어간다.** scope 는
비워두면 가장 넓은 값이 되어 조용히 다른 앱을 잡아먹는다.

### [2026-08-09] start_url 끝 슬래시 하나로 PWA 가 시작하자마자 제 영역을 벗어난다

**증상**: 기사님 앱을 설치하면 홈 화면 아이콘이 404 를 열었다.

**원인 두 겹**:
1. `start_url: "/driver/"` 인데 `/driver` 페이지 자체가 없었다(토큰 주소
   `/driver/[token]` 만 존재). manifest 의 start_url 은 **반드시 실제로 열리는
   주소**여야 한다.
2. 페이지를 만든 뒤에도 함정이 남는다. Next 는 기본값(`trailingSlash: false`)에서
   `/driver/` → `/driver` 로 **308 되돌린다**. 그런데 scope 는 `/driver/` 라
   최종 주소가 영역 밖이 된다. 앱이 시작하자마자 브라우저로 튕길 수 있다.

**해결**: start_url·scope 를 **둘 다 끝 슬래시 없이** `/driver` 로 맞춘다.
`/driver/[token]` 은 문자열 prefix 로 `/driver` 안에 들어간다.

**확인법**: `curl -o /dev/null -w "%{http_code} %{redirect_url}" <start_url>`
로 **리다이렉트가 없는지** 본다. 200 이 아니면 앱 아이콘이 그 화면을 연다.

**교훈**: start_url 은 "설정값"이 아니라 **매번 실행되는 주소**다. 눈으로 열어보고
리다이렉트까지 확인해야 한다. scope 도 비워두면 기본값이 들어간다(같은 날
공식 앱 scope 사고와 같은 형태).
