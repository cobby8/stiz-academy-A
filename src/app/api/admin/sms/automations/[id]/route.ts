import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const CHANNELS = new Set(["ALIMTALK", "SMS", "LMS", "RCS"]);
const FALLBACKS = new Set(["NONE", "SMS", "LMS"]);

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        await requireAdmin();
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

    const current = await prisma.$queryRawUnsafe<Array<{
        audienceScope: string;
        trigger: string;
        templateId: string | null;
    }>>(
        `SELECT "audienceScope", trigger, "templateId"
           FROM "MessageAutomationRule" WHERE id = $1 LIMIT 1`,
        id,
    );
    if (!current.length) return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    if (current[0].audienceScope === "SECURITY") {
        return NextResponse.json({ error: "Security messages cannot be changed" }, { status: 409 });
    }

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

    values.push(id);
    await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
            `UPDATE "MessageAutomationRule"
                SET ${sets.join(", ")}, "updatedAt" = NOW()
              WHERE id = $${values.length}`,
            ...values,
        );
        if (typeof body.isActive === "boolean" && current[0].templateId) {
            await tx.$executeRawUnsafe(
                `UPDATE "SmsTemplate" SET "isActive" = $1, "updatedAt" = NOW() WHERE id = $2`,
                body.isActive,
                current[0].templateId,
            );
        }
    });

    return NextResponse.json({ ok: true });
}
