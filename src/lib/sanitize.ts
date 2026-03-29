/**
 * HTML 새니타이징 유틸리티 — XSS(크로스 사이트 스크립팅) 방지
 *
 * dangerouslySetInnerHTML로 렌더링하는 모든 HTML은
 * 반드시 이 함수를 거쳐서 악성 스크립트를 제거한 뒤 사용해야 한다.
 *
 * isomorphic-dompurify는 서버(Node.js)와 클라이언트(브라우저) 양쪽에서 동작한다.
 */

import DOMPurify from "isomorphic-dompurify";

/**
 * HTML 문자열에서 위험한 태그/속성을 제거하고 안전한 HTML만 반환
 * - <script>, onerror, onclick 등 악성 코드 자동 제거
 * - <p>, <strong>, <em>, <br>, <h1>~<h6> 등 안전한 태그는 유지
 */
export function sanitizeHtml(dirty: string): string {
    return DOMPurify.sanitize(dirty);
}
