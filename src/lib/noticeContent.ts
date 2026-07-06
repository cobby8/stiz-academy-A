/**
 * 공지사항 본문/첨부 렌더링 유틸
 *
 * - toNoticeHtml: 순수 텍스트 공지 본문을 "안전한 HTML"로 변환한다.
 *   · 모든 텍스트를 HTML 이스케이프하여 XSS를 차단
 *   · http(s):// 또는 www. 로 시작하는 URL을 클릭 가능한 <a> 링크로 변환
 *   · 줄바꿈은 렌더링 쪽의 `whitespace-pre-wrap` CSS로 그대로 유지
 *   · 출력은 이 함수 안에서 이미 완전히 이스케이프되므로 별도 sanitize 불필요
 * - isImageAttachment: 첨부가 이미지인지 판별 (본문 아래 인라인 노출용)
 *
 * 업로드 API(`/api/upload`)는 이미지 타입만 허용하므로 대부분의 첨부는 이미지다.
 * 다만 과거 데이터/예외를 대비해 확장자로 방어적으로 판별한다.
 */

export type NoticeAttachment = { url: string; filename: string; size?: number };

/** 첨부파일이 이미지인지 판별 (url 또는 filename의 확장자 기준) */
export function isImageAttachment(a: { url?: string; filename?: string } | null | undefined): boolean {
    if (!a) return false;
    const s = `${a.url || ""} ${a.filename || ""}`;
    return /\.(jpe?g|png|webp|gif|bmp|svg|avif)(\?|#|$)/i.test(s);
}

/** HTML 특수문자 이스케이프 — 사용자 텍스트가 태그로 해석되지 않도록 */
function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * 순수 텍스트 공지 본문 → 안전한 HTML (URL 자동 링크 포함)
 * 렌더링 시 반드시 `whitespace-pre-wrap` 컨테이너에 dangerouslySetInnerHTML로 넣어
 * 줄바꿈이 유지되도록 한다.
 */
export function toNoticeHtml(text: string | null | undefined): string {
    if (!text) return "";
    // http(s):// 또는 www. 로 시작하고 공백/꺾쇠 전까지
    const urlRe = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
    let out = "";
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = urlRe.exec(text)) !== null) {
        // URL 이전 일반 텍스트
        out += escapeHtml(text.slice(last, m.index));

        let url = m[0];
        let trail = "";
        // 문장 끝 구두점은 링크에서 제외 (예: "사이트: https://a.com." → 마침표 제외)
        const tp = url.match(/[),.!?;:]+$/);
        if (tp) {
            trail = tp[0];
            url = url.slice(0, -trail.length);
        }
        const href = url.startsWith("www.") ? `https://${url}` : url;
        out +=
            `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" ` +
            `class="text-brand-orange-600 dark:text-brand-neon-lime underline underline-offset-2 break-all hover:opacity-80">` +
            `${escapeHtml(url)}</a>`;
        out += escapeHtml(trail);
        last = m.index + m[0].length;
    }
    // 마지막 URL 이후 남은 텍스트
    out += escapeHtml(text.slice(last));

    // 이 함수는 모든 사용자 텍스트를 escapeHtml로 이스케이프하고,
    // 화이트리스트 <a> 태그(href/표시문구 모두 escape)만 직접 삽입하므로
    // 출력이 이미 안전하다. (별도 sanitize 라이브러리 불필요 → jsdom 의존 제거)
    return out;
}

/**
 * 순수 텍스트에 URL이 포함돼 있는지 (목록 미리보기에서 "링크 포함" 표시 등 용도)
 */
export function hasUrl(text: string | null | undefined): boolean {
    if (!text) return false;
    return /(https?:\/\/|www\.)\S+/i.test(text);
}
