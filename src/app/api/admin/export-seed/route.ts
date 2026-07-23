/**
 * GET /api/admin/export-seed
 *
 * ?꾩옱 DB??Programs, ClassSlotOverrides, AcademySettings(termsOfService)??
 * prisma/seed-data.ts ??諛붾줈 遺숈뿬?ｌ쓣 ???덈뒗 TypeScript 肄붾뱶濡?蹂?섑빀?덈떎.
 *
 * ?ъ슜踰?
 * 1. 愿由ъ옄 ?섏씠吏 ??"?쒕뱶 ?곗씠???대낫?닿린" ?대┃
 * 2. 異쒕젰??肄붾뱶瑜?prisma/seed-data.ts ??遺숈뿬?ｊ린
 * 3. git commit & push ???댄썑 DB 珥덇린????/api/admin/seed 濡?蹂듦뎄 媛??
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

function safeNum(v: unknown): number | null {
    if (v == null) return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
}

function quote(v: unknown): string {
    if (v == null) return "null";
    const s = String(v).replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
    return "`" + s + "`";
}

export async function GET() {
    // ?몄쬆 泥댄겕: 濡쒓렇?명븳 愿由ъ옄留??쒕뱶 ?곗씠???대낫?닿린 媛??
    try {
        await requireOwner();
    } catch {
        return NextResponse.json({ error: "원장 권한이 필요합니다." }, { status: 403 });
    }

    try {
        const [programRows, slotRows, settingsRows] = await Promise.all([
            prisma.$queryRawUnsafe<any[]>(
                `SELECT id, name, "targetAge", description, days,
                        "priceWeek1", "priceWeek2", "priceWeek3", "priceDaily",
                        "shuttleFeeOverride", "order"
                 FROM "Program" ORDER BY "order" ASC, "createdAt" ASC`
            ).catch(() => [] as any[]),
            prisma.$queryRawUnsafe<any[]>(
                `SELECT id, "slotKey", label, note, "isHidden", capacity,
                        "startTimeOverride", "endTimeOverride", "coachId", "programId"
                 FROM "ClassSlotOverride" ORDER BY "slotKey" ASC`
            ).catch(() => [] as any[]),
            prisma.$queryRawUnsafe<any[]>(
                `SELECT "termsOfService" FROM "AcademySettings" WHERE id = 'singleton' LIMIT 1`
            ).catch(() => [] as any[]),
        ]);

        const terms = settingsRows[0]?.termsOfService ?? settingsRows[0]?.termsofservice ?? null;

        const lines: string[] = [
            `/**`,
            ` * 시드 데이터 - 프로그램 목록 영구 보존용`,
            ` *`,
            ` * ?좑툘 ???뚯씪???꾨줈洹몃옩 ?곗씠?곕? 湲곕줉???먯꽭??`,
            ` *    DB ?곗씠???뚯떎 ??/api/admin/seed POST 濡?蹂듦뎄?⑸땲??`,
            ` *`,
            ` * 留덉?留??대낫?닿린: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`,
            ` */`,
            ``,
            `export interface SeedProgram {`,
            `    id: string;`,
            `    name: string;`,
            `    targetAge: string | null;`,
            `    description: string | null;`,
            `    days: string | null;`,
            `    priceWeek1: number | null;`,
            `    priceWeek2: number | null;`,
            `    priceWeek3: number | null;`,
            `    priceDaily: number | null;`,
            `    shuttleFeeOverride: number | null;`,
            `    order: number;`,
            `}`,
            ``,
            `export const PROGRAMS: SeedProgram[] = [`,
        ];

        for (const p of programRows) {
            lines.push(`    {`);
            lines.push(`        id: ${quote(p.id)},`);
            lines.push(`        name: ${quote(p.name)},`);
            lines.push(`        targetAge: ${quote(p.targetAge ?? p.targetage)},`);
            lines.push(`        description: ${quote(p.description)},`);
            lines.push(`        days: ${quote(p.days)},`);
            lines.push(`        priceWeek1: ${safeNum(p.priceWeek1 ?? p.priceweek1)},`);
            lines.push(`        priceWeek2: ${safeNum(p.priceWeek2 ?? p.priceweek2)},`);
            lines.push(`        priceWeek3: ${safeNum(p.priceWeek3 ?? p.priceweek3)},`);
            lines.push(`        priceDaily: ${safeNum(p.priceDaily ?? p.pricedaily)},`);
            lines.push(`        shuttleFeeOverride: ${safeNum(p.shuttleFeeOverride ?? p.shuttlefeeoverride)},`);
            lines.push(`        order: ${safeNum(p.order) ?? 0},`);
            lines.push(`    },`);
        }

        lines.push(`];`);
        lines.push(``);
        lines.push(`export const CLASS_SLOT_OVERRIDES: any[] = [`);

        for (const s of slotRows) {
            lines.push(`    {`);
            lines.push(`        id: ${quote(s.id)},`);
            lines.push(`        slotKey: ${quote(s.slotKey ?? s.slotkey)},`);
            lines.push(`        label: ${quote(s.label)},`);
            lines.push(`        note: ${quote(s.note)},`);
            lines.push(`        isHidden: ${s.isHidden ?? s.ishidden ?? false},`);
            lines.push(`        capacity: ${safeNum(s.capacity) ?? 12},`);
            lines.push(`        startTimeOverride: ${quote(s.startTimeOverride ?? s.starttimeoverride)},`);
            lines.push(`        endTimeOverride: ${quote(s.endTimeOverride ?? s.endtimeoverride)},`);
            lines.push(`        coachId: ${quote(s.coachId ?? s.coachid)},`);
            lines.push(`        programId: ${quote(s.programId ?? s.programid)},`);
            lines.push(`    },`);
        }

        lines.push(`];`);
        lines.push(``);
        lines.push(`/** ?댁슜?쎄? (AcademySettings.termsOfService) */`);
        lines.push(`export const TERMS_OF_SERVICE: string | null = ${quote(terms)};`);
        lines.push(``);

        const code = lines.join("\n");

        return new NextResponse(code, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Content-Disposition": `attachment; filename="seed-data.ts"`,
            },
        });
    } catch (e) {
        return NextResponse.json({ error: "?쒕쾭 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." }, { status: 500 });
    }
}
