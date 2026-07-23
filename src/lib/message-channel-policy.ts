export type MessageAudience = "INTERNAL" | "EXTERNAL" | "AUTH";
export type MessageChannel = "AUTO" | "SMS" | "LMS" | "ALIMTALK" | "RCS";
export type DeliveredMessageChannel = Exclude<MessageChannel, "AUTO">;

export type MessageChannelPolicy = {
    requestedChannel: MessageChannel;
    primaryChannel: DeliveredMessageChannel;
    fallbackChannel: "SMS" | "LMS" | null;
    fallbackAllowed: boolean;
};

export function isAlimtalkConfigured(templateId?: string): boolean {
    return Boolean(
        process.env.SMS_PROVIDER?.trim().toUpperCase() !== "BIZPPURIO"
        && process.env.SOLAPI_API_KEY?.trim()
        && process.env.SOLAPI_API_SECRET?.trim()
        && process.env.SOLAPI_SENDER?.trim()
        && process.env.SOLAPI_KAKAO_PF_ID?.trim()
        && templateId?.trim(),
    );
}

export function resolveMessageChannelPolicy(input: {
    audience: MessageAudience;
    requestedChannel?: MessageChannel;
    body: string;
    alimtalkTemplateId?: string;
    fallbackEnabled?: boolean;
    fallbackChannel?: "SMS" | "LMS" | null;
}): MessageChannelPolicy {
    const requestedChannel = input.requestedChannel ?? "AUTO";
    const textFallback = Buffer.byteLength(input.body, "utf8") <= 90 ? "SMS" : "LMS";

    // 인증번호는 도착 가능성과 예측 가능성이 가장 중요하므로 다른 채널로 우회하지 않는다.
    if (input.audience === "AUTH") {
        return {
            requestedChannel,
            primaryChannel: "SMS",
            fallbackChannel: null,
            fallbackAllowed: false,
        };
    }

    if (requestedChannel === "AUTO") {
        const primaryChannel = isAlimtalkConfigured(input.alimtalkTemplateId)
            ? "ALIMTALK"
            : textFallback;
        return {
            requestedChannel,
            primaryChannel,
            fallbackChannel: primaryChannel === "ALIMTALK" ? textFallback : null,
            fallbackAllowed: primaryChannel === "ALIMTALK",
        };
    }

    if (requestedChannel === "ALIMTALK" || requestedChannel === "RCS") {
        const fallbackChannel = input.fallbackEnabled === false
            ? null
            : input.fallbackChannel ?? textFallback;
        return {
            requestedChannel,
            primaryChannel: requestedChannel,
            fallbackChannel,
            fallbackAllowed: input.fallbackEnabled !== false,
        };
    }

    return {
        requestedChannel,
        primaryChannel: requestedChannel,
        fallbackChannel: null,
        fallbackAllowed: false,
    };
}

export function estimateMessageCost(channel: DeliveredMessageChannel): number {
    switch (channel) {
        case "ALIMTALK":
        case "RCS":
            return 13;
        case "SMS":
            return 18;
        case "LMS":
            return 45;
    }
}
