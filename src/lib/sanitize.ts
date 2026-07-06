/**
 * HTML 새니타이징 유틸리티 — XSS(크로스 사이트 스크립팅) 방지
 *
 * dangerouslySetInnerHTML로 렌더링하는 모든 HTML은
 * 반드시 이 함수를 거쳐서 악성 스크립트를 제거한 뒤 사용해야 한다.
 *
 * 왜 sanitize-html 인가?
 * - 이전에는 isomorphic-dompurify를 썼는데, 이 라이브러리는 서버에서 jsdom을 끌어온다.
 *   jsdom의 전이 의존성(@exodus/bytes)이 ESM 전용이라, Vercel 서버리스(Next 16)가
 *   require()로 로딩하다 ERR_REQUIRE_ESM으로 터져 라우트 전체가 500이 되는 문제가 있었다.
 * - sanitize-html은 htmlparser2 기반 순수 JS라 jsdom을 전혀 쓰지 않는다.
 *   서버/클라이언트 어디서든 동일하게 동작하며 서버리스에서 안전하다.
 *
 * 정화 대상 콘텐츠는 관리자가 TipTap 에디터로 작성한 리치 텍스트(소개글 등)다.
 * 따라서 서식(굵게/기울임/제목/목록/색상/정렬/이미지/링크)은 최대한 보존하고,
 * <script>·이벤트 핸들러(onclick 등)·javascript: 링크 같은 위험 요소만 제거한다.
 */

import sanitizeHtmlLib from "sanitize-html";

// 허용 태그 — sanitize-html 기본 목록 + TipTap가 만들어내는 서식 태그를 추가
const ALLOWED_TAGS = [
    ...sanitizeHtmlLib.defaults.allowedTags, // p, a, ul, ol, li, b, i, strong, em, code, hr, br, div, blockquote, h3~h6, table, colgroup, col, thead, tbody, tr, th, td 등
    "img", // 이미지(Supabase 업로드 URL)
    "h1",
    "h2", // 큰 제목 (기본 목록엔 h3부터라 h1/h2 추가)
    "span", // 색상/폰트 스타일이 들어가는 인라인 래퍼
    "u", // 밑줄
    "s",
    "strike",
    "del",
    "ins", // 취소선/삽입선
    "sub",
    "sup", // 아래/위 첨자
    "mark", // 형광펜
    "small",
    "figure",
    "figcaption",
    // ── 공지 리치 에디터 5단계: 유튜브 임베드용 ──
    // iframe은 sanitize-html 기본 목록에 없어 명시적으로 추가한다.
    // ⚠️ iframe을 허용하는 순간 XSS/클릭재킹 위험이 생기므로, 아래 sanitizeHtml()에서
    //    allowedIframeHostnames(유튜브 도메인 화이트리스트)로 src 호스트를 반드시 제한한다.
    "iframe",
    // colgroup/col/div/table 계열은 이미 defaults에 포함되어 있으나(표·유튜브 래퍼),
    // 명시적으로 두어 의도를 드러낸다(중복 무해).
    "div", // 유튜브 래퍼 div[data-youtube-video]
    "colgroup", // 표 열 그룹
    "col", // 표 열 (열 너비 조절 시 style="width:Npx")
];

/**
 * HTML 문자열에서 위험한 태그/속성을 제거하고 안전한 HTML만 반환
 * - <script>, onerror, onclick 등 악성 코드 자동 제거
 * - <p>, <strong>, <em>, <br>, <h1>~<h6>, 색상/정렬 등 서식은 유지
 */
// 표/열 style 속성에서 허용할 폭 값 형식 — 정수/소수 px만 (예: "75px", "120.5px")
// position/expression/url() 등 위험 값은 이 형식에 걸리지 않아 자동 제거된다.
const PX_VALUE = /^\d+(?:\.\d+)?px$/;

export function sanitizeHtml(dirty: string): string {
    return sanitizeHtmlLib(dirty, {
        allowedTags: ALLOWED_TAGS,
        allowedAttributes: {
            // 모든 태그에 class/style 허용 (TipTap의 정렬·색상 표현이 style로 들어옴)
            // ※ style 값은 아래 allowedStyles로, class 값(img)은 allowedClasses로 재차 걸러진다.
            "*": ["class", "style"],
            a: ["href", "name", "target", "rel"],
            // 이미지 정렬(data-align) + 크기(width, 정수 px). class는 allowedClasses.img로 제한.
            img: ["src", "alt", "title", "width", "height", "data-align"],
            // 유튜브 iframe — src 호스트는 allowedIframeHostnames로 유튜브만 허용.
            //   onload 등 이벤트 핸들러는 목록에 없으므로 자동 차단(화이트리스트 방식).
            iframe: ["src", "width", "height", "allowfullscreen", "frameborder", "allow"],
            // 유튜브 래퍼 div — 파싱용 표식 속성만.
            div: ["data-youtube-video"],
            // 표 셀 병합/열너비 속성.
            td: ["colspan", "rowspan", "colwidth"],
            th: ["colspan", "rowspan", "colwidth"],
        },
        // class 값 화이트리스트 — img에는 정렬 3종만 허용(그 외 class는 제거).
        // 다른 태그의 class는 기존처럼 제한 없음(회귀 방지).
        allowedClasses: {
            img: ["align-left", "align-center", "align-right"],
        },
        // style 속성 안에서 허용할 CSS 속성 (그 외는 제거)
        // ⚠️ sanitize-html은 `allowedStyles[태그] || allowedStyles['*']` 로 동작한다(합집합 아님, override).
        //    → table/col에 전용 항목을 두면 '*'의 색상/정렬 등은 적용되지 않고 width 계열만 남는다.
        allowedStyles: {
            "*": {
                color: [/.*/],
                "background-color": [/.*/],
                "text-align": [/.*/],
                "text-decoration": [/.*/],
                "font-family": [/.*/],
                "font-size": [/.*/],
                "font-weight": [/.*/],
                "font-style": [/.*/],
            },
            // 표 전체 폭 — min-width/width(px)만. 색상/position 등은 차단.
            table: {
                width: [PX_VALUE],
                "min-width": [PX_VALUE],
            },
            // 표 열 너비 — width(px)만.
            col: {
                width: [PX_VALUE],
            },
        },
        // 링크 스킴 화이트리스트 — javascript: 등 위험 스킴 차단
        allowedSchemes: ["http", "https", "mailto", "tel"],
        // 태그별 스킴 제한: 이미지 src는 data: URI(인라인 base64)도 허용,
        //                  iframe src는 https만 허용(http 다운그레이드 차단).
        allowedSchemesByTag: {
            img: ["http", "https", "data"],
            iframe: ["https"],
        },
        // 🔒 iframe src 호스트 화이트리스트 — 유튜브(임베드/nocookie)만 허용.
        //    이 목록에 없는 호스트(evil.com 등)의 iframe은 통째로 제거된다. 보안의 핵심.
        //    4단계에서 확장이 src를 항상 https://www.youtube.com/embed/<ID> 로 정규화하므로
        //    youtu.be 등은 목록에 불필요.
        allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com"],
        // 링크에 rel="noopener noreferrer" 자동 부여(탭내빙 방지).
        // 세 번째 인자 생략 = merge=true → 기존 href/target 속성은 그대로 보존한다.
        transformTags: {
            a: sanitizeHtmlLib.simpleTransform("a", { rel: "noopener noreferrer" }),
        },
        // 🔒 iframe 이중 방어 — allowedIframeHostnames는 비유튜브 iframe의 src만 제거하고
        //    빈 <iframe></iframe> 껍데기를 남긴다(harmless지만 지저분). 여기서 src가 사라진
        //    iframe을 통째로 삭제해 비유튜브/data:/http 등 무효 iframe이 남지 않게 한다.
        exclusiveFilter: (frame) => frame.tag === "iframe" && !frame.attribs.src,
    });
}
