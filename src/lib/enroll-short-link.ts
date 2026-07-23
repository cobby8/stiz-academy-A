import "server-only";

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

const DEFAULT_TTL_DAYS = 14;
const CODE_BYTES = 12; // 96비트: 짧지만 임의 추측은 현실적으로 불가능한 크기
const TARGET_PATH = "/apply/enroll";

type ShortLinkRow = {
    code: string;
    trialLeadId: string;
    targetPath: string;
    expiresAt: Date;
};

function normalizePublicBaseUrl(raw: string | undefined) {
    if (!raw?.trim()) return null;

    const candidate = raw.trim().startsWith("http")
        ? raw.trim()
        : `https://${raw.trim()}`;
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("공개 사이트 주소는 http 또는 https 주소여야 합니다.");
    }
    return url.origin;
}

export function getEnrollmentShortLinkBaseUrl() {
    const configured = process.env.SHORT_LINK_BASE_URL
        || process.env.NEXT_PUBLIC_SITE_URL
        || process.env.NEXT_PUBLIC_BASE_URL
        || process.env.VERCEL_URL;
    const baseUrl = normalizePublicBaseUrl(configured);
    if (!baseUrl) {
        throw new Error("SHORT_LINK_BASE_URL 또는 공개 사이트 주소 설정이 필요합니다.");
    }
    return baseUrl;
}

export function buildEnrollmentShortUrl(code: string) {
    if (!/^[A-Za-z0-9_-]{16}$/.test(code)) {
        throw new Error("올바르지 않은 수강신청 링크 코드입니다.");
    }
    return `${getEnrollmentShortLinkBaseUrl()}/e/${code}`;
}

export async function createEnrollmentShortLink(
    trialLeadId: string,
    options: { ttlDays?: number } = {},
) {
    const ttlDays = options.ttlDays ?? DEFAULT_TTL_DAYS;
    if (!trialLeadId.trim()) throw new Error("체험 신청 정보가 필요합니다.");
    if (!Number.isInteger(ttlDays) || ttlDays < 1 || ttlDays > 30) {
        throw new Error("링크 유효기간은 1~30일이어야 합니다.");
    }

    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1_000);

    // 극히 드문 코드 충돌은 새 난수로 최대 세 번 재시도합니다.
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const code = randomBytes(CODE_BYTES).toString("base64url");
        try {
            const rows = await prisma.$queryRawUnsafe<ShortLinkRow[]>(
                `INSERT INTO "EnrollmentShortLink"
                    ("id", "code", "trialLeadId", "targetPath", "isActive", "expiresAt", "createdAt", "updatedAt")
                 SELECT (gen_random_uuid())::text, $1, id, $2, true, $3, NOW(), NOW()
                   FROM "TrialLead"
                  WHERE id = $4
                 RETURNING "code", "trialLeadId", "targetPath", "expiresAt"`,
                code,
                TARGET_PATH,
                expiresAt,
                trialLeadId,
            );
            if (!rows[0]) throw new Error("체험 신청 정보를 찾을 수 없습니다.");
            return {
                ...rows[0],
                url: buildEnrollmentShortUrl(rows[0].code),
            };
        } catch (error) {
            const databaseCode = (error as { code?: string }).code;
            if (databaseCode === "P2002" || databaseCode === "23505") continue;
            throw error;
        }
    }
    throw new Error("짧은 링크를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.");
}

// 등록전환 서버 액션이 사용하는 좁은 계약입니다.
export async function createTrialEnrollShortLink(trialLeadId: string) {
    const link = await createEnrollmentShortLink(trialLeadId);
    return {
        shortUrl: link.url,
        code: link.code,
        expiresAt: link.expiresAt,
    };
}

export async function resolveEnrollmentShortLink(code: string) {
    if (!/^[A-Za-z0-9_-]{16}$/.test(code)) return null;

    const rows = await prisma.$queryRawUnsafe<ShortLinkRow[]>(
        `SELECT "code", "trialLeadId", "targetPath", "expiresAt"
           FROM "EnrollmentShortLink"
          WHERE "code" = $1
            AND "isActive" = true
            AND "expiresAt" > NOW()
          LIMIT 1`,
        code,
    );
    return rows[0] ?? null;
}
