/**
 * SMS 발송 유틸 — NHN Cloud SMS API 연동
 *
 * 환경변수가 설정되지 않으면 console.log로 fallback (에러 안 남)
 * 실패해도 절대 예외를 던지지 않음 (알림 실패가 비즈니스 로직을 막으면 안 됨)
 *
 * 필요한 환경변수:
 *   NHN_SMS_APP_KEY      — NHN Cloud 프로젝트 앱 키
 *   NHN_SMS_SECRET_KEY   — NHN Cloud SMS 시크릿 키
 *   NHN_SMS_SENDER       — 발신번호 (사전 등록 필수, 예: "01012345678")
 */

const NHN_APP_KEY = process.env.NHN_SMS_APP_KEY || "";
const NHN_SECRET_KEY = process.env.NHN_SMS_SECRET_KEY || "";
const NHN_SENDER = process.env.NHN_SMS_SENDER || "";

// NHN Cloud SMS API 엔드포인트 (단문 SMS)
const NHN_SMS_URL = NHN_APP_KEY
    ? `https://api-sms.cloud.toast.com/sms/v3.0/appKeys/${NHN_APP_KEY}/sender/sms`
    : "";

/**
 * sendSms — 단문 SMS 발송
 *
 * @param to   수신 번호 (하이픈 포함/미포함 모두 가능, "010-1234-5678" or "01012345678")
 * @param body 메시지 본문 (90바이트 이내 권장, 초과 시 LMS 전환 필요)
 * @returns    성공 여부 (true/false). 실패해도 예외를 던지지 않음
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
    // 수신번호에서 하이픈 제거
    const recipientNo = to.replace(/-/g, "");

    // 환경변수 미설정 시 fallback — 콘솔에만 출력
    if (!NHN_SMS_URL || !NHN_SECRET_KEY || !NHN_SENDER) {
        console.log(`[SMS fallback] to=${recipientNo} body="${body}"`);
        return false;
    }

    try {
        const res = await fetch(NHN_SMS_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json;charset=UTF-8",
                "X-Secret-Key": NHN_SECRET_KEY,
            },
            body: JSON.stringify({
                body,
                sendNo: NHN_SENDER,
                recipientList: [{ recipientNo }],
            }),
        });

        const json = await res.json();

        // NHN Cloud는 HTTP 200이어도 header.isSuccessful로 성공 여부 판단
        if (json?.header?.isSuccessful) {
            return true;
        } else {
            console.warn("[SMS] NHN API 실패:", json?.header?.resultMessage || JSON.stringify(json));
            return false;
        }
    } catch (e) {
        // 네트워크 에러 등 — 절대 throw 하지 않음
        console.error("[SMS] 발송 실패:", (e as Error).message);
        return false;
    }
}
