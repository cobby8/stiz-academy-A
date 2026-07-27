import { NextResponse } from "next/server";
import { resolveRunToken, getBoardingMap } from "@/lib/seasonal/shuttleRun";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 임시 진단용 엔드포인트 — 확인 후 삭제
// GET ?token=X&date=Y → getBoardingMap 결과 + 날것 DB 조회 결과 반환
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const date = url.searchParams.get("date") ?? "";

  const run = await resolveRunToken(token);
  if (!run) return NextResponse.json({ error: "invalid token" }, { status: 404 });

  const [pickup, dropoff] = await Promise.all([
    getBoardingMap(date, "PICKUP"),
    getBoardingMap(date, "DROPOFF"),
  ]);

  // raw DB 직접 조회
  let rawRows: unknown[] = [];
  try {
    rawRows = await prisma.$queryRawUnsafe(
      `SELECT "serviceDate", "direction", "shuttleRequestId", "studentName", "status" FROM "ShuttleBoarding" WHERE "serviceDate" = $1 ORDER BY direction`,
      date,
    );
  } catch (e) {
    rawRows = [{ error: String(e) }];
  }

  return NextResponse.json({
    run,
    queriedDate: date,
    boardingMap: { PICKUP: pickup, DROPOFF: dropoff },
    rawRows,
  });
}
