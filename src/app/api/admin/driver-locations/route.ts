import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export type DriverLocationRow = {
  token: string;
  label: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  sharing: boolean;
  updatedAt: string;
  secondsAgo: number;
};

// 관리자 전용 — 최근 10분 이내에 위치를 전송한 기사 목록
export async function GET() {
  try {
    await requireAdmin();

    const rows = await prisma.$queryRawUnsafe<DriverLocationRow[]>(
      `SELECT
         token, label, latitude, longitude,
         accuracy, speed, heading, sharing,
         "updatedAt"::text AS "updatedAt",
         EXTRACT(EPOCH FROM (now() - "updatedAt"))::int AS "secondsAgo"
       FROM "DriverLocation"
       WHERE "updatedAt" > now() - INTERVAL '10 minutes'
       ORDER BY "updatedAt" DESC`,
    );

    return NextResponse.json(
      { locations: rows },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[admin/driver-locations GET]", e);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
