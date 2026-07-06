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
    ...sanitizeHtmlLib.defaults.allowedTags, // p, a, ul, ol, li, b, i, strong, em, code, hr, br, div, blockquote, h3~h6, table 등
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
];

/**
 * HTML 문자열에서 위험한 태그/속성을 제거하고 안전한 HTML만 반환
 * - <script>, onerror, onclick 등 악성 코드 자동 제거
 * - <p>, <strong>, <em>, <br>, <h1>~<h6>, 색상/정렬 등 서식은 유지
 */
export function sanitizeHtml(dirty: string): string {
    return sanitizeHtmlLib(dirty, {
        allowedTags: ALLOWED_TAGS,
        allowedAttributes: {
            // 모든 태그에 class/style 허용 (TipTap의 정렬·색상 표현이 style로 들어옴)
            "*": ["class", "style"],
            a: ["href", "name", "target", "rel"],
            img: ["src", "alt", "title", "width", "height"],
        },
        // style 속성 안에서 허용할 CSS 속성 (그 외는 제거)
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
        },
        // 링크 스킴 화이트리스트 — javascript: 등 위험 스킴 차단
        allowedSchemes: ["http", "https", "mailto", "tel"],
        // 이미지 src는 data: URI(인라인 base64)도 허용
        allowedSchemesByTag: { img: ["http", "https", "data"] },
        // 링크에 rel="noopener noreferrer" 자동 부여(탭내빙 방지).
        // 세 번째 인자 생략 = merge=true → 기존 href/target 속성은 그대로 보존한다.
        transformTags: {
            a: sanitizeHtmlLib.simpleTransform("a", { rel: "noopener noreferrer" }),
        },
    });
}
