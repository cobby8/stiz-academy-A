/**
 * SMS 발송 유틸 — 솔라피(Solapi) REST API 연동
 *
 * 솔라피 API 문서: https://docs.solapi.com/api-reference/messages
 * 인증: HMAC-SHA256 서명 방식
 *
 * 환경변수가 설정되지 않으면 console.log로 fallback (에러 안 남)
 * 실패해도 절대 예외를 던지지 않음 (알림 실패가 비즈니스 로직을 막으면 안 됨)
 *
 * 필요한 환경변수:
 *   SOLAPI_API_KEY     — 솔라피 API Key
 *   SOLAPI_API_SECRET  — 솔라피 API Secret
 *   SOLAPI_SENDER      — 발신번호 (사전 등록 필수, 예: "01012345678")
 */

import crypto from "crypto";

const API_KEY = process.env.SOLAPI_API_KEY || "";
const API_SECRET = process.env.SOLAPI_API_SECRET || "";
const SENDER = process.env.SOLAPI_SENDER || "";

// 솔라피 메시지 발송 엔드포인트
const SOLAPI_URL = "https://api.solapi.com/messages/v4/send";

/**
 * 솔라피 HMAC-SHA256 인증 헤더를 생성하는 함수
 *
 * 서명 방식: HMAC-SHA256(date + salt, API_SECRET)
 * date = ISO 8601 형식 (예: "2026-03-29T15:00:00.000Z")
 * salt = 랜덤 문자열 (replay attack 방지)
 */
function makeAuthHeader(): string {
    const date = new Date().toISOString();
    // 16바이트 랜덤 hex 문자열을 salt로 사용
    const salt = crypto.randomBytes(16).toString("hex");
    // date + salt를 합쳐서 API_SECRET으로 HMAC-SHA256 서명
    const signature = crypto
        .createHmac("sha256", API_SECRET)
        .update(date + salt)
        .digest("hex");

    return `HMAC-SHA256 apiKey=${API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

/**
 * sendSms — 단문 SMS 발송
 *
 * @param to   수신 번호 (하이픈 포함/미포함 모두 가능, "010-1234-5678" or "01012345678")
 * @param body 메시지 본문 (90바이트 이내 권장, 초과 시 LMS로 자동 전환됨)
 * @returns    성공 여부 (true/false). 실패해도 예외를 던지지 않음
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
    // 수신번호에서 하이픈 제거
    const recipientNo = to.replace(/-/g, "");

    // 환경변수 미설정 시 fallback — 콘솔에만 출력
    if (!API_KEY || !API_SECRET || !SENDER) {
        console.log(`[SMS fallback] to=${recipientNo} body="${body}"`);
        return false;
    }

    try {
        const res = await fetch(SOLAPI_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: makeAuthHeader(),
            },
            body: JSON.stringify({
                message: {
                    to: recipientNo,
                    from: SENDER,
                    text: body,
                },
            }),
        });

        const json = await res.json();

        // 솔라피 응답: groupId가 있으면 성공, statusCode가 에러면 실패
        if (res.ok && json?.groupId) {
            return true;
        } else {
            console.warn("[SMS] Solapi API 실패:", json?.errorMessage || json?.statusCode || JSON.stringify(json));
            return false;
        }
    } catch (e) {
        // 네트워크 에러 등 — 절대 throw 하지 않음
        console.error("[SMS] 발송 실패:", (e as Error).message);
        return false;
    }
}

/**
 * sendSmsBulk — 여러 명에게 동일 메시지 일괄 발송
 *
 * 솔라피 API는 건별 발송이므로 순차 호출. 실패한 건은 무시하고 계속 진행.
 *
 * @param recipients  수신 번호 배열
 * @param body        메시지 본문
 * @returns           { total: 전체 수, success: 성공 수, failed: 실패 수 }
 */
export async function sendSmsBulk(
    recipients: string[],
    body: string,
): Promise<{ total: number; success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const to of recipients) {
        const ok = await sendSms(to, body);
        if (ok) success++;
        else failed++;
    }

    return { total: recipients.length, success, failed };
}
