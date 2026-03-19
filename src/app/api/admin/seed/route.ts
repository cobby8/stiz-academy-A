/**
 * POST /api/admin/seed
 *
 * prisma/seed-data.ts 에 저장된 프로그램 데이터를 DB에 복원합니다.
 * DB가 비어있거나 데이터 소실 시 복구용으로 사용합니다.
 * 이미 존재하는 ID는 upsert(덮어쓰기)로 처리됩니다.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { PROGRAMS, CLASS_SLOT_OVERRIDES, TERMS_OF_SERVICE } from "../../../../../prisma/seed-data";

export const dynamic = "force-dynamic";

export async function POST() {
    // 인증 체크: 로그인한 관리자만 시드 데이터 복원 가능
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "인증 필요" }, { status: 401 });
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
        results.programs = "seed-data.ts 에 프로그램 데이터가 없습니다";
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
        results.classSlotOverrides = "seed-data.ts 에 슬롯 데이터가 없습니다";
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
            results.termsOfService = `실패: ${e}`;
        }
    } else {
        results.termsOfService = "seed-data.ts 에 이용약관 데이터가 없습니다";
    }

    return NextResponse.json({ success: true, results, seedFile: "prisma/seed-data.ts" });
}
