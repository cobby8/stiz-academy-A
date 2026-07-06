# 에러 및 함정 모음
<!-- 담당: debugger, tester | 최대 30항목 -->
<!-- 이 프로젝트에서 반복되는 에러 패턴, 함정, 주의사항을 기록 -->

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
