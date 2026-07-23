import crypto from "crypto";
import {
    getSmsMessageType,
    getSmsProviderName,
    sendSmsDetailed,
    type SmsProvider,
} from "@/lib/sms";
import {
    estimateMessageCost,
    isAlimtalkConfigured,
    resolveMessageChannelPolicy,
    type DeliveredMessageChannel,
    type MessageAudience,
    type MessageChannel,
} from "@/lib/message-channel-policy";

const SOLAPI_URL = "https://api.solapi.com/messages/v4/send";
const MESSAGE_REQUEST_TIMEOUT_MS = 5000;

export type MessageDispatchInput = {
    to: string;
    body: string;
    audience: MessageAudience;
    requestedChannel?: MessageChannel;
    fallbackEnabled?: boolean;
    fallbackChannel?: "SMS" | "LMS" | null;
    alimtalk?: {
        templateId: string;
        variables?: Record<string, string>;
    };
    rcs?: {
        templateId: string;
        brandId?: string;
    };
};

export type MessageDispatchResult = {
    ok: boolean;
    to: string;
    provider: SmsProvider;
    requestedChannel: MessageChannel;
    actualChannel: DeliveredMessageChannel;
    fallbackUsed: boolean;
    estimatedCostWon: number;
    groupId?: string;
    messageId?: string;
    reason?: string;
};

export const SECURITY_PHONE_OTP_TRIGGER = "SECURITY_PHONE_OTP";

// 인증번호는 관리자 설정과 관계없이 SMS로 고정하고 다른 채널로 우회하지 않는다.
export async function sendAuthenticationSms(to: string, body: string): Promise<boolean> {
    const result = await sendMessageDetailed({
        to,
        body,
        audience: "AUTH",
        requestedChannel: "SMS",
        fallbackEnabled: false,
        fallbackChannel: null,
    });
    return result.ok;
}

function normalizePhone(value: string): string {
    return value.replace(/\D/g, "");
}

function solapiAuthorization(): string {
    const date = new Date().toISOString();
    const salt = crypto.randomBytes(16).toString("hex");
    const signature = crypto
        .createHmac("sha256", process.env.SOLAPI_API_SECRET || "")
        .update(date + salt)
        .digest("hex");
    return `HMAC-SHA256 apiKey=${process.env.SOLAPI_API_KEY || ""}, date=${date}, salt=${salt}, signature=${signature}`;
}

async function sendSolapiAlimtalk(input: MessageDispatchInput): Promise<MessageDispatchResult> {
    const to = normalizePhone(input.to);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MESSAGE_REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(SOLAPI_URL, {
            method: "POST",
            signal: controller.signal,
            headers: {
                "Content-Type": "application/json",
                Authorization: solapiAuthorization(),
            },
            body: JSON.stringify({
                message: {
                    to,
                    from: normalizePhone(process.env.SOLAPI_SENDER || ""),
                    text: input.body,
                    kakaoOptions: {
                        pfId: process.env.SOLAPI_KAKAO_PF_ID,
                        templateId: input.alimtalk!.templateId,
                        variables: input.alimtalk?.variables,
                    },
                },
            }),
        });
        const json = await response.json().catch(() => null) as Record<string, unknown> | null;
        if (response.ok && json?.groupId) {
            return {
                ok: true,
                to,
                provider: "SOLAPI",
                requestedChannel: input.requestedChannel ?? "AUTO",
                actualChannel: "ALIMTALK",
                fallbackUsed: false,
                estimatedCostWon: estimateMessageCost("ALIMTALK"),
                groupId: String(json.groupId),
                messageId: typeof json.messageId === "string" ? json.messageId : undefined,
            };
        }
        const reason = json?.errorMessage || json?.message || json?.statusCode || response.status;
        return {
            ok: false,
            to,
            provider: "SOLAPI",
            requestedChannel: input.requestedChannel ?? "AUTO",
            actualChannel: "ALIMTALK",
            fallbackUsed: false,
            estimatedCostWon: 0,
            reason: `Solapi Alimtalk failed: ${String(reason)}`,
        };
    } catch (error) {
        const reason = error instanceof Error && error.name === "AbortError"
            ? `request timed out after ${MESSAGE_REQUEST_TIMEOUT_MS}ms`
            : error instanceof Error ? error.message : String(error);
        return {
            ok: false,
            to,
            provider: "SOLAPI",
            requestedChannel: input.requestedChannel ?? "AUTO",
            actualChannel: "ALIMTALK",
            fallbackUsed: false,
            estimatedCostWon: 0,
            reason: `Solapi Alimtalk request failed: ${reason}`,
        };
    } finally {
        clearTimeout(timeout);
    }
}

async function sendTextFallback(
    input: MessageDispatchInput,
    requestedChannel: MessageChannel,
    fallbackUsed: boolean,
    fallbackChannel?: "SMS" | "LMS" | null,
): Promise<MessageDispatchResult> {
    const textChannel = fallbackChannel
        ?? (requestedChannel === "LMS" ? "LMS" : undefined);
    const result = await sendSmsDetailed(
        input.to,
        input.body,
        textChannel === "LMS" ? { messageType: "LMS" } : undefined,
    );
    const actualChannel = result.messageType ?? getSmsMessageType(input.body);
    return {
        ok: result.ok,
        to: result.to,
        provider: result.provider ?? getSmsProviderName(),
        requestedChannel,
        actualChannel,
        fallbackUsed,
        estimatedCostWon: result.ok ? estimateMessageCost(actualChannel) : 0,
        groupId: result.groupId,
        messageId: result.messageId,
        reason: result.reason,
    };
}

export async function sendMessageDetailed(input: MessageDispatchInput): Promise<MessageDispatchResult> {
    const requestedChannel = input.requestedChannel ?? "AUTO";
    const policy = resolveMessageChannelPolicy({
        audience: input.audience,
        requestedChannel,
        body: input.body,
        alimtalkTemplateId: input.alimtalk?.templateId,
        fallbackEnabled: input.fallbackEnabled,
        fallbackChannel: input.fallbackChannel,
    });

    if (
        policy.primaryChannel === "ALIMTALK"
        && input.alimtalk
        && isAlimtalkConfigured(input.alimtalk.templateId)
    ) {
        const primary = await sendSolapiAlimtalk(input);
        if (primary.ok || !policy.fallbackAllowed) return primary;
        return sendTextFallback(input, requestedChannel, true, policy.fallbackChannel);
    }

    // RCS는 브랜드 등록 전에는 호출하지 않는다. 정책과 결과 타입만 미리 열고 문자로 안전하게 대체한다.
    if (policy.primaryChannel === "RCS" || policy.primaryChannel === "ALIMTALK") {
        if (!policy.fallbackAllowed) {
            return {
                ok: false,
                to: normalizePhone(input.to),
                provider: getSmsProviderName(),
                requestedChannel,
                actualChannel: policy.primaryChannel,
                fallbackUsed: false,
                estimatedCostWon: 0,
                reason: `${policy.primaryChannel} 채널이 연결되지 않아 발송하지 않았습니다.`,
            };
        }
        return sendTextFallback(input, requestedChannel, true, policy.fallbackChannel);
    }

    return sendTextFallback(input, requestedChannel, false, policy.fallbackChannel);
}
