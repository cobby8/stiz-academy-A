/**
 * GET /api/admin/export-seed
 *
 * 현재 DB의 Programs, ClassSlotOverrides, AcademySettings(termsOfService)를
 * prisma/seed-data.ts에 붙여 넣을 수 있는 TypeScript 코드로 내보낸다.
 *
 * 사용법:
 * 1. 관리자 페이지에서 시드 데이터 내보내기를 실행한다.
 * 2. 출력된 코드를 prisma/seed-data.ts에 붙여 넣는다.
 * 3. 커밋/푸시 후 /api/admin/seed로 DB 초기 데이터를 복구할 수 있다.
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
    // 원장 권한이 있는 사용자만 시드 데이터를 내보낼 수 있다.
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
            ` * 이 파일은 프로그램 데이터를 기록합니다.`,
            ` * DB 데이터가 필요할 때 /api/admin/seed POST로 복구합니다.`,
            ` *`,
            ` * 마지막 내보내기: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`,
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
        lines.push(`/** 이용약관 (AcademySettings.termsOfService) */`);
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
        return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
    }
}
