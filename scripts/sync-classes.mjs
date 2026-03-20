/**
 * syncScheduleToClasses 실행 스크립트
 *
 * SheetSlotCache + ClassSlotOverride + CustomClassSlot → Class 테이블 동기화
 * 그 후 slotKey가 NULL인 기존 수동 Class 삭제
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const prisma = new PrismaClient();

const DAY_KEY_TO_LABEL = {
    Mon: "월요일", Tue: "화요일", Wed: "수요일", Thu: "목요일",
    Fri: "금요일", Sat: "토요일", Sun: "일요일",
};

async function main() {
    console.log("=== syncScheduleToClasses 실행 시작 ===\n");

    // ── 1. 시간표 데이터 수집 ──
    const cacheRows = await prisma.$queryRawUnsafe(
        `SELECT "slotsJson" FROM "SheetSlotCache" WHERE id = 'singleton' LIMIT 1`
    );
    const rawSlots = cacheRows[0]
        ? JSON.parse(cacheRows[0].slotsJson ?? cacheRows[0].slotsjson ?? "[]")
        : [];
    console.log(`SheetSlotCache 슬롯 수: ${rawSlots.length}`);

    // ClassSlotOverride 목록
    const overrides = await prisma.$queryRawUnsafe(
        `SELECT cso.id, cso."slotKey", cso.label, cso.note, cso."isHidden", cso.capacity,
                cso."startTimeOverride", cso."endTimeOverride", cso."coachId", cso."programId"
         FROM "ClassSlotOverride" cso`
    );
    const overrideMap = Object.fromEntries(
        overrides.map((o) => [o.slotKey ?? o.slotkey, o])
    );
    console.log(`ClassSlotOverride 수: ${overrides.length}`);

    // CustomClassSlot 목록
    const customSlots = await prisma.$queryRawUnsafe(
        `SELECT cs.id, cs."dayKey", cs."startTime", cs."endTime", cs.label,
                cs."gradeRange", cs.enrolled, cs.capacity, cs.note, cs."isHidden",
                cs."coachId", cs."programId"
         FROM "CustomClassSlot" cs`
    );
    console.log(`CustomClassSlot 수: ${customSlots.length}`);

    // ── 2. MergedSlot 생성 ──
    const mergedSlots = [];

    for (const s of rawSlots) {
        const ov = overrideMap[s.slotKey];
        if (ov && (ov.isHidden ?? ov.ishidden)) continue;

        mergedSlots.push({
            slotKey: s.slotKey,
            dayKey: s.dayKey,
            label: ov?.label || `${DAY_KEY_TO_LABEL[s.dayKey] || s.dayKey} ${s.period}교시`,
            startTime: (ov?.startTimeOverride ?? ov?.starttimeoverride) || s.startTime,
            endTime: (ov?.endTimeOverride ?? ov?.endtimeoverride) || s.endTime,
            capacity: Number(ov?.capacity ?? 12),
            programId: (ov?.programId ?? ov?.programid) || null,
        });
    }

    for (const cs of customSlots) {
        if (cs.isHidden ?? cs.ishidden) continue;
        mergedSlots.push({
            slotKey: `custom-${cs.id}`,
            dayKey: cs.dayKey ?? cs.daykey,
            label: cs.label,
            startTime: cs.startTime ?? cs.starttime,
            endTime: cs.endTime ?? cs.endtime,
            capacity: Number(cs.capacity ?? 12),
            programId: (cs.programId ?? cs.programid) || null,
        });
    }

    console.log(`\n총 MergedSlot 수: ${mergedSlots.length}`);

    // ── 3. 프로그램 이름 조회 ──
    const programs = await prisma.$queryRawUnsafe(`SELECT id, name FROM "Program"`);
    const programNameMap = Object.fromEntries(programs.map((p) => [p.id, p.name]));

    // ── 4. Class 테이블과 동기화 ──
    let created = 0, updated = 0, skipped = 0;
    const errors = [];

    for (const slot of mergedSlots) {
        try {
            if (!slot.programId) {
                skipped++;
                console.log(`  [SKIP] ${slot.label} (${slot.slotKey}) - programId 없음`);
                continue;
            }
            if (!programNameMap[slot.programId]) {
                skipped++;
                errors.push(`슬롯 "${slot.label}" (${slot.slotKey}): 프로그램 ID "${slot.programId}" 없음`);
                continue;
            }

            const existing = await prisma.$queryRawUnsafe(
                `SELECT id FROM "Class" WHERE "slotKey" = $1 LIMIT 1`,
                slot.slotKey,
            );

            if (existing.length > 0) {
                await prisma.$executeRawUnsafe(
                    `UPDATE "Class" SET
                        name = $1, "dayOfWeek" = $2, "startTime" = $3, "endTime" = $4,
                        capacity = $5, "programId" = $6, "updatedAt" = NOW()
                     WHERE "slotKey" = $7`,
                    slot.label, slot.dayKey, slot.startTime, slot.endTime,
                    slot.capacity, slot.programId, slot.slotKey,
                );
                updated++;
                console.log(`  [UPDATE] ${slot.label} (${slot.slotKey}) -> ${programNameMap[slot.programId]}`);
            } else {
                await prisma.$executeRawUnsafe(
                    `INSERT INTO "Class" (id, "programId", name, "dayOfWeek", "startTime", "endTime", capacity, "slotKey", "createdAt", "updatedAt")
                     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
                    slot.programId, slot.label, slot.dayKey, slot.startTime, slot.endTime,
                    slot.capacity, slot.slotKey,
                );
                created++;
                console.log(`  [CREATE] ${slot.label} (${slot.slotKey}) -> ${programNameMap[slot.programId]}`);
            }
        } catch (e) {
            errors.push(`슬롯 "${slot.label}" (${slot.slotKey}) 실패: ${e.message}`);
        }
    }

    console.log(`\n=== 동기화 결과 ===`);
    console.log(`  생성: ${created}, 업데이트: ${updated}, 건너뜀: ${skipped}`);
    if (errors.length) console.log(`  에러: ${errors.join('\n  ')}`);

    // ── 5. 기존 수동 Class 확인 및 삭제 ──
    console.log(`\n=== 기존 수동 Class (slotKey IS NULL) 확인 ===`);
    const oldClasses = await prisma.$queryRawUnsafe(
        `SELECT c.id, c.name, COUNT(e.id)::int as cnt
         FROM "Class" c
         LEFT JOIN "Enrollment" e ON c.id = e."classId"
         WHERE c."slotKey" IS NULL
         GROUP BY c.id, c.name`
    );

    if (oldClasses.length === 0) {
        console.log("  수동 Class 없음 - 삭제할 것 없음");
    } else {
        for (const c of oldClasses) {
            console.log(`  ID: ${c.id}, 이름: ${c.name}, Enrollment: ${c.cnt}`);
        }

        // Enrollment가 0인 것만 삭제
        const safeToDelete = oldClasses.filter(c => c.cnt === 0);
        if (safeToDelete.length > 0) {
            const deleteResult = await prisma.$executeRawUnsafe(
                `DELETE FROM "Class" WHERE "slotKey" IS NULL AND id NOT IN (SELECT DISTINCT "classId" FROM "Enrollment")`
            );
            console.log(`\n  삭제 완료: ${deleteResult}개 수동 Class 삭제됨`);
        } else {
            console.log(`\n  ⚠️ Enrollment가 있는 수동 Class가 있어 삭제하지 않음`);
        }
    }

    // ── 6. 최종 Class 목록 출력 ──
    console.log(`\n=== 최종 Class 테이블 전체 목록 ===`);
    const allClasses = await prisma.$queryRawUnsafe(
        `SELECT c.id, c.name, c."slotKey", c."dayOfWeek", c."startTime", c."endTime", c.capacity, p.name as program_name
         FROM "Class" c
         LEFT JOIN "Program" p ON c."programId" = p.id
         ORDER BY c."dayOfWeek", c."startTime"`
    );

    console.log(`\n총 ${allClasses.length}개 Class:\n`);
    console.log("ID | 이름 | slotKey | 요일 | 시작 | 종료 | 정원 | 프로그램");
    console.log("-".repeat(120));
    for (const c of allClasses) {
        console.log(`${c.id} | ${c.name} | ${c.slotKey ?? c.slotkey ?? 'NULL'} | ${c.dayOfWeek ?? c.dayofweek} | ${c.startTime ?? c.starttime} | ${c.endTime ?? c.endtime} | ${c.capacity} | ${c.program_name}`);
    }

    await prisma.$disconnect();
    console.log("\n=== 완료 ===");
}

main().catch(async (e) => {
    console.error("실행 오류:", e);
    await prisma.$disconnect();
    process.exit(1);
});
