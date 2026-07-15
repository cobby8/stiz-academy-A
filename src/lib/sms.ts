import crypto from "crypto";

const API_KEY = process.env.SOLAPI_API_KEY || "";
const API_SECRET = process.env.SOLAPI_API_SECRET || "";
const SENDER = process.env.SOLAPI_SENDER || "";
const SOLAPI_URL = "https://api.solapi.com/messages/v4/send";

export type SmsSendResult = {
    ok: boolean;
    to: string;
    reason?: string;
};

function makeAuthHeader(): string {
    const date = new Date().toISOString();
    const salt = crypto.randomBytes(16).toString("hex");
    const signature = crypto
        .createHmac("sha256", API_SECRET)
        .update(date + salt)
        .digest("hex");

    return `HMAC-SHA256 apiKey=${API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

export async function sendSmsDetailed(to: string, body: string): Promise<SmsSendResult> {
    const recipientNo = to.replace(/-/g, "");

    if (!API_KEY || !API_SECRET || !SENDER) {
        const reason = "SMS environment variables are missing.";
        // 인증번호·개인 초대 링크가 포함될 수 있으므로 문자 본문은 서버 로그에 남기지 않는다.
        const maskedRecipient = recipientNo.length >= 4 ? `***${recipientNo.slice(-4)}` : "***";
        console.log(`[SMS fallback] to=${maskedRecipient} bodyLength=${body.length}`);
        return { ok: false, to: recipientNo, reason };
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

        if (res.ok && json?.groupId) {
            return { ok: true, to: recipientNo };
        }

        const reason = json?.errorMessage || json?.message || json?.statusCode || JSON.stringify(json);
        console.warn("[SMS] Solapi API failed:", reason);
        return { ok: false, to: recipientNo, reason: `Solapi failed: ${reason}` };
    } catch (e) {
        const reason = (e as Error).message;
        console.error("[SMS] Send failed:", reason);
        return { ok: false, to: recipientNo, reason: `SMS request failed: ${reason}` };
    }
}

export async function sendSms(to: string, body: string): Promise<boolean> {
    const result = await sendSmsDetailed(to, body);
    return result.ok;
}

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
