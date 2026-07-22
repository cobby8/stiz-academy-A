import crypto from "crypto";

const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY || "";
const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET || "";
const SOLAPI_SENDER = normalizeSmsNumber(process.env.SOLAPI_SENDER || "");
const SOLAPI_URL = "https://api.solapi.com/messages/v4/send";

const BIZPPURIO_ACCOUNT = process.env.BIZPPURIO_ACCOUNT || "";
const BIZPPURIO_PASSWORD = process.env.BIZPPURIO_PASSWORD || process.env.BIZPPURIO_API_KEY || "";
const BIZPPURIO_SENDER = normalizeSmsNumber(process.env.BIZPPURIO_SENDER || process.env.BIZPPURIO_FROM || "");
const BIZPPURIO_DEFAULT_HOST = process.env.NODE_ENV === "production"
    ? "api.bizppurio.com"
    : "dev-api.bizppurio.com";

const SMS_REQUEST_TIMEOUT_MS = 5000;
const BIZPPURIO_TOKEN_SAFETY_MS = 60_000;

export type SmsProvider = "SOLAPI" | "BIZPPURIO";

type BizppurioTokenCache = {
    token: string;
    expiresAt: number;
};

type JsonObject = Record<string, unknown>;

let bizppurioTokenCache: BizppurioTokenCache | null = null;

export type SmsSendResult = {
    ok: boolean;
    to: string;
    reason?: string;
};

function normalizeSmsNumber(value: string): string {
    return value.replace(/\D/g, "");
}

function currentSmsProvider(): SmsProvider {
    const configured = (process.env.SMS_PROVIDER || "").trim().toUpperCase();
    if (configured === "BIZPPURIO" || configured === "BIZ_PPURIO" || configured === "PPURIO") return "BIZPPURIO";
    if (configured === "SOLAPI" || configured === "COOLSMS") return "SOLAPI";
    return BIZPPURIO_ACCOUNT ? "BIZPPURIO" : "SOLAPI";
}

export function getSmsProviderName(): SmsProvider {
    return currentSmsProvider();
}

export function isSmsProviderConfigured(provider: SmsProvider = currentSmsProvider()): boolean {
    if (provider === "BIZPPURIO") return Boolean(BIZPPURIO_ACCOUNT && BIZPPURIO_PASSWORD && BIZPPURIO_SENDER);
    return Boolean(SOLAPI_API_KEY && SOLAPI_API_SECRET && SOLAPI_SENDER);
}

export function smsProviderMissingReason(provider: SmsProvider = currentSmsProvider()): string | null {
    if (isSmsProviderConfigured(provider)) return null;
    const missing = provider === "BIZPPURIO"
        ? [
            ["BIZPPURIO_ACCOUNT", BIZPPURIO_ACCOUNT],
            ["BIZPPURIO_PASSWORD or BIZPPURIO_API_KEY", BIZPPURIO_PASSWORD],
            ["BIZPPURIO_SENDER or BIZPPURIO_FROM", BIZPPURIO_SENDER],
        ]
        : [
            ["SOLAPI_API_KEY", SOLAPI_API_KEY],
            ["SOLAPI_API_SECRET", SOLAPI_API_SECRET],
            ["SOLAPI_SENDER", SOLAPI_SENDER],
        ];
    const names = missing.filter(([, value]) => !value).map(([name]) => name).join(", ");
    return `${provider} SMS environment variables are missing: ${names}`;
}

function makeSolapiAuthHeader(): string {
    const date = new Date().toISOString();
    const salt = crypto.randomBytes(16).toString("hex");
    const signature = crypto
        .createHmac("sha256", SOLAPI_API_SECRET)
        .update(date + salt)
        .digest("hex");

    return `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

function bizppurioBaseUrl(): string {
    const host = (process.env.BIZPPURIO_HOST || BIZPPURIO_DEFAULT_HOST)
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/+$/, "");
    return `https://${host}`;
}

function parseBizppurioExpiresAt(expired?: string): number {
    if (!expired || !/^\d{14}$/.test(expired)) {
        return Date.now() + 23 * 60 * 60 * 1000;
    }

    const year = Number(expired.slice(0, 4));
    const month = Number(expired.slice(4, 6));
    const day = Number(expired.slice(6, 8));
    const hour = Number(expired.slice(8, 10));
    const minute = Number(expired.slice(10, 12));
    const second = Number(expired.slice(12, 14));

    // Bizppurio expiry is returned as Korea local time.
    return Date.UTC(year, month - 1, day, hour - 9, minute, second);
}

function bizppurioMessageType(body: string): "sms" | "lms" {
    return Buffer.byteLength(body, "utf8") <= 90 ? "sms" : "lms";
}

async function readJsonSafely(response: Response): Promise<JsonObject | null> {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

async function getBizppurioToken(signal: AbortSignal): Promise<string> {
    const now = Date.now();
    if (bizppurioTokenCache && bizppurioTokenCache.expiresAt - BIZPPURIO_TOKEN_SAFETY_MS > now) {
        return bizppurioTokenCache.token;
    }

    const basic = Buffer.from(`${BIZPPURIO_ACCOUNT}:${BIZPPURIO_PASSWORD}`).toString("base64");
    const response = await fetch(`${bizppurioBaseUrl()}/v1/token`, {
        method: "POST",
        signal,
        headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/json; charset=utf-8",
        },
    });
    const json = await readJsonSafely(response);
    const token = [json?.accesstoken, json?.accessToken, json?.token]
        .find((value): value is string => typeof value === "string" && value.length > 0);

    if (!response.ok || !token) {
        const reason = json?.description || json?.message || json?.code || response.status;
        throw new Error(`Bizppurio token failed: ${reason}`);
    }

    bizppurioTokenCache = {
        token,
        expiresAt: parseBizppurioExpiresAt(typeof json?.expired === "string" ? json.expired : undefined),
    };
    return token;
}

async function sendSolapiSms(recipientNo: string, body: string, signal: AbortSignal): Promise<SmsSendResult> {
    const res = await fetch(SOLAPI_URL, {
        method: "POST",
        signal,
        headers: {
            "Content-Type": "application/json",
            Authorization: makeSolapiAuthHeader(),
        },
        body: JSON.stringify({
            message: {
                to: recipientNo,
                from: SOLAPI_SENDER,
                text: body,
            },
        }),
    });

    const json = await readJsonSafely(res);

    if (res.ok && json?.groupId) {
        return { ok: true, to: recipientNo };
    }

    const reason = json?.errorMessage || json?.message || json?.statusCode || JSON.stringify(json);
    console.warn("[SMS] Solapi API failed:", reason);
    return { ok: false, to: recipientNo, reason: `Solapi failed: ${reason}` };
}

async function sendBizppurioSms(recipientNo: string, body: string, signal: AbortSignal): Promise<SmsSendResult> {
    const token = await getBizppurioToken(signal);
    const type = bizppurioMessageType(body);
    const refkey = `stiz${Date.now().toString(36)}${crypto.randomBytes(8).toString("hex")}`.slice(0, 32);
    const content = type === "sms"
        ? { sms: { message: body } }
        : { lms: { subject: "STIZ 알림", message: body } };

    const res = await fetch(`${bizppurioBaseUrl()}/v3/message`, {
        method: "POST",
        signal,
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
            account: BIZPPURIO_ACCOUNT,
            refkey,
            type,
            from: BIZPPURIO_SENDER,
            to: recipientNo,
            content,
        }),
    });

    const json = await readJsonSafely(res);

    if (res.ok && String(json?.code) === "1000") {
        return { ok: true, to: recipientNo };
    }

    const reason = json?.description || json?.message || json?.code || JSON.stringify(json);
    console.warn("[SMS] Bizppurio API failed:", reason);
    return { ok: false, to: recipientNo, reason: `Bizppurio failed: ${reason}` };
}

export async function sendSmsDetailed(to: string, body: string): Promise<SmsSendResult> {
    const recipientNo = normalizeSmsNumber(to);
    const provider = currentSmsProvider();
    const missingReason = smsProviderMissingReason(provider);

    if (recipientNo.length < 10 || recipientNo.length > 11) {
        return { ok: false, to: recipientNo, reason: "Invalid SMS recipient." };
    }

    if (missingReason) {
        // Do not print phone numbers or message bodies. Some messages include login codes or private notes.
        const maskedRecipient = recipientNo.length >= 4 ? `***${recipientNo.slice(-4)}` : "***";
        console.log(`[SMS fallback] provider=${provider} to=${maskedRecipient} bodyLength=${body.length}`);
        return { ok: false, to: recipientNo, reason: missingReason };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SMS_REQUEST_TIMEOUT_MS);

    try {
        return provider === "BIZPPURIO"
            ? await sendBizppurioSms(recipientNo, body, controller.signal)
            : await sendSolapiSms(recipientNo, body, controller.signal);
    } catch (e) {
        const reason = e instanceof Error && e.name === "AbortError"
            ? `SMS request timed out after ${SMS_REQUEST_TIMEOUT_MS}ms`
            : (e as Error).message;
        console.error("[SMS] Send failed:", reason);
        return { ok: false, to: recipientNo, reason: `SMS request failed: ${reason}` };
    } finally {
        clearTimeout(timeout);
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
