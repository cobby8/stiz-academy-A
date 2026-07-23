/**
 * POST /api/admin/seed
 *
 * prisma/seed-data.ts ????λ맂 ?꾨줈洹몃옩 ?곗씠?곕? DB??蹂듭썝?⑸땲??
 * DB媛 鍮꾩뼱?덇굅???곗씠???뚯떎 ??蹂듦뎄?⑹쑝濡??ъ슜?⑸땲??
 * ?대? 議댁옱?섎뒗 ID??upsert(??뼱?곌린)濡?泥섎━?⑸땲??
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth-guard";
import { PROGRAMS, CLASS_SLOT_OVERRIDES, TERMS_OF_SERVICE } from "../../../../../prisma/seed-data";

export const dynamic = "force-dynamic";

export async function POST() {
    // ?몄쬆 泥댄겕: 濡쒓렇?명븳 愿由ъ옄留??쒕뱶 ?곗씠??蹂듭썝 媛??
    try {
        await requireOwner();
    } catch {
        return NextResponse.json({ error: "원장 권한이 필요합니다." }, { status: 403 });
    }

    const results: Record<string, string> = {};

    // Restore Programs
    if (PROGRAMS.length > 0) {
        let restored = 0;
        for (const p of PROGRAMS) {
            try {
                await prisma.$executeRawUnsafe(
                    `INSERT INTO "Program" (
                        id, name, "targetAge", description, days,
                        "priceWeek1", "priceWeek2", "priceWeek3", "priceDaily",
                        "shuttleFeeOverride", "order", price,
                        "createdAt", "updatedAt"
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        "targetAge" = EXCLUDED."targetAge",
                        description = EXCLUDED.description,
                        days = EXCLUDED.days,
                        "priceWeek1" = EXCLUDED."priceWeek1",
                        "priceWeek2" = EXCLUDED."priceWeek2",
                        "priceWeek3" = EXCLUDED."priceWeek3",
                        "priceDaily" = EXCLUDED."priceDaily",
                        "shuttleFeeOverride" = EXCLUDED."shuttleFeeOverride",
                        "order" = EXCLUDED."order",
                        "updatedAt" = NOW()`,
                    p.id,
                    p.name,
                    p.targetAge,
                    p.description,
                    p.days,
                    p.priceWeek1,
                    p.priceWeek2,
                    p.priceWeek3,
                    p.priceDaily,
                    p.shuttleFeeOverride,
                    p.order,
                    p.priceWeek1 ?? p.priceWeek2 ?? p.priceWeek3 ?? 0, // price fallback
                );
                restored++;
            } catch (e) {
                console.error(`[seed] Program "${p.name}" failed:`, e);
            }
        }
        results.programs = `${restored}/${PROGRAMS.length}개 복원됨`;
    } else {
        results.programs = "seed-data.ts ???꾨줈洹몃옩 ?곗씠?곌? ?놁뒿?덈떎";
    }

    // Restore ClassSlotOverrides
    if (CLASS_SLOT_OVERRIDES.length > 0) {
        let restored = 0;
        for (const s of CLASS_SLOT_OVERRIDES) {
            try {
                await prisma.$executeRawUnsafe(
                    `INSERT INTO "ClassSlotOverride" (
                        id, "slotKey", label, note, "isHidden", capacity,
                        "startTimeOverride", "endTimeOverride",
                        "coachId", "programId", "createdAt", "updatedAt"
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
                    ON CONFLICT ("slotKey") DO UPDATE SET
                        label = EXCLUDED.label,
                        note = EXCLUDED.note,
                        "isHidden" = EXCLUDED."isHidden",
                        capacity = EXCLUDED.capacity,
                        "startTimeOverride" = EXCLUDED."startTimeOverride",
                        "endTimeOverride" = EXCLUDED."endTimeOverride",
                        "coachId" = EXCLUDED."coachId",
                        "programId" = EXCLUDED."programId",
                        "updatedAt" = NOW()`,
                    s.id, s.slotKey, s.label, s.note,
                    s.isHidden ?? false, s.capacity ?? 12,
                    s.startTimeOverride ?? null, s.endTimeOverride ?? null,
                    s.coachId ?? null, s.programId ?? null,
                );
                restored++;
            } catch (e) {
                console.error(`[seed] Slot "${s.slotKey}" failed:`, e);
            }
        }
        results.classSlotOverrides = `${restored}/${CLASS_SLOT_OVERRIDES.length}개 복원됨`;
    } else {
        results.classSlotOverrides = "seed-data.ts ???щ’ ?곗씠?곌? ?놁뒿?덈떎";
    }

    // Restore Terms of Service
    if (typeof TERMS_OF_SERVICE === "string" && TERMS_OF_SERVICE.length > 0) {
        try {
            await prisma.$executeRawUnsafe(
                `INSERT INTO "AcademySettings" (id, "termsOfService", "createdAt", "updatedAt")
                 VALUES ('singleton', $1, NOW(), NOW())
                 ON CONFLICT (id) DO UPDATE SET
                     "termsOfService" = EXCLUDED."termsOfService",
                     "updatedAt" = NOW()`,
                TERMS_OF_SERVICE,
            );
            results.termsOfService = "이용약관 복원됨";
        } catch (e) {
            console.error("[seed] termsOfService failed:", e);
            results.termsOfService = `?ㅽ뙣: ${e}`;
        }
    } else {
        results.termsOfService = "seed-data.ts ???댁슜?쎄? ?곗씠?곌? ?놁뒿?덈떎";
    }

    return NextResponse.json({ success: true, results, seedFile: "prisma/seed-data.ts" });
}
