import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const CHANNELS = new Set(["ALIMTALK", "SMS", "LMS", "RCS"]);
const FALLBACKS = new Set(["NONE", "SMS", "LMS"]);

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    let admin: Awaited<ReturnType<typeof requireAdmin>>;
    try {
        admin = await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => null) as {
        isActive?: unknown;
        primaryChannel?: unknown;
        fallbackChannel?: unknown;
    } | null;
    if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const sets: string[] = [];
    const values: unknown[] = [];
    if (typeof body.isActive === "boolean") {
        values.push(body.isActive);
        sets.push(`"isActive" = $${values.length}`);
    }
    if (typeof body.primaryChannel === "string") {
        if (!CHANNELS.has(body.primaryChannel)) {
            return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
        }
        values.push(body.primaryChannel === "ALIMTALK" ? "KAKAO_ALIMTALK" : body.primaryChannel);
        sets.push(`"requestedChannel" = $${values.length}`);
    }
    if (typeof body.fallbackChannel === "string") {
        if (!FALLBACKS.has(body.fallbackChannel)) {
            return NextResponse.json({ error: "Invalid fallback channel" }, { status: 400 });
        }
        values.push(body.fallbackChannel !== "NONE");
        sets.push(`"fallbackEnabled" = $${values.length}`);
        values.push(body.fallbackChannel === "NONE" ? null : body.fallbackChannel);
        sets.push(`"fallbackChannel" = $${values.length}`);
    }
    if (!sets.length) return NextResponse.json({ ok: true });

    const [auditInfrastructure] = await prisma.$queryRawUnsafe<Array<{ available: boolean }>>(
        `SELECT to_regclass('public."MessageSettingAuditLog"') IS NOT NULL AS available`,
    ).catch(() => [{ available: false }]);
    if (!auditInfrastructure.available) {
        return NextResponse.json(
            { error: "Message settings migration is required" },
            { status: 503 },
        );
    }

    const result = await prisma.$transaction(async (tx) => {
        const current = await tx.$queryRawUnsafe<Array<{
            audienceScope: string;
            trigger: string;
            templateId: string | null;
            isActive: boolean;
            requestedChannel: string | null;
            fallbackEnabled: boolean;
            fallbackChannel: string | null;
        }>>(
            `SELECT "audienceScope", trigger, "templateId", "isActive",
                    "requestedChannel", "fallbackEnabled", "fallbackChannel"
               FROM "MessageAutomationRule"
              WHERE id = $1
              FOR UPDATE`,
            id,
        );
        if (!current.length) return "NOT_FOUND" as const;
        if (current[0].audienceScope === "SECURITY") return "SECURITY" as const;

        const updateValues = [...values, id];
        await tx.$executeRawUnsafe(
            `UPDATE "MessageAutomationRule"
                SET ${sets.join(", ")}, "updatedAt" = NOW()
              WHERE id = $${updateValues.length}`,
            ...updateValues,
        );
        if (typeof body.isActive === "boolean" && current[0].templateId) {
            await tx.$executeRawUnsafe(
                `UPDATE "SmsTemplate" SET "isActive" = $1, "updatedAt" = NOW() WHERE id = $2`,
                body.isActive,
                current[0].templateId,
            );
        }

        const [after] = await tx.$queryRawUnsafe<Array<{
            audienceScope: string;
            trigger: string;
            templateId: string | null;
            isActive: boolean;
            requestedChannel: string | null;
            fallbackEnabled: boolean;
            fallbackChannel: string | null;
        }>>(
            `SELECT "audienceScope", trigger, "templateId", "isActive",
                    "requestedChannel", "fallbackEnabled", "fallbackChannel"
               FROM "MessageAutomationRule" WHERE id = $1`,
            id,
        );
        if (!after) throw new Error("Automation update verification failed");
        const safePolicy = (rule: typeof current[number]) => ({
            audienceScope: rule.audienceScope,
            trigger: rule.trigger,
            templateId: rule.templateId,
            isActive: rule.isActive,
            requestedChannel: rule.requestedChannel,
            fallbackEnabled: rule.fallbackEnabled,
            fallbackChannel: rule.fallbackChannel,
        });
        await tx.$executeRawUnsafe(
            `INSERT INTO "MessageSettingAuditLog" (
                id, "settingType", "settingId", action, "actorUserId", "actorName",
                "beforeJSON", "afterJSON", "createdAt"
             ) VALUES (
                gen_random_uuid()::text, 'AUTOMATION_RULE', $1, 'UPDATE', $2, $3,
                $4::jsonb, $5::jsonb, NOW()
             )`,
            id,
            admin.appUserId,
            admin.appUserName,
            JSON.stringify(safePolicy(current[0])),
            JSON.stringify(safePolicy(after)),
        );
        return "UPDATED" as const;
    });
    if (result === "NOT_FOUND") {
        return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }
    if (result === "SECURITY") {
        return NextResponse.json({ error: "Security messages cannot be changed" }, { status: 409 });
    }

    return NextResponse.json({ ok: true });
}
