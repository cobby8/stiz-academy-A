import { NextResponse } from "next/server";
import { resolveRunToken, getBoardingMap } from "@/lib/seasonal/shuttleRun";
import { getDispatchForView } from "@/lib/seasonal/shuttle-optimize";
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

  // dispatch에서 실제로 반환하는 학생 requestId 확인
  let dispatchStudents: unknown[] = [];
  try {
    const [pickupSug, dropoffSug] = await Promise.all([
      getDispatchForView(date, "PICKUP", true),
      getDispatchForView(date, "DROPOFF", true),
    ]);
    const extract = (sug: Awaited<ReturnType<typeof getDispatchForView>>, dir: string) =>
      (sug.vehicles as {stops?: {students?: {requestId: string; name: string}[]}[]}[])
        .flatMap((v) => v.stops ?? [])
        .flatMap((s) => s.students ?? [])
        .map((st) => ({ dir, name: st.name, requestId: st.requestId, inBoardingMap: dir === "PICKUP" ? pickup[st.requestId] ?? null : dropoff[st.requestId] ?? null }));
    dispatchStudents = [...extract(pickupSug, "PICKUP"), ...extract(dropoffSug, "DROPOFF")];
  } catch (e) {
    dispatchStudents = [{ error: String(e) }];
  }

  return NextResponse.json({
    run,
    queriedDate: date,
    boardingMap: { PICKUP: pickup, DROPOFF: dropoff },
    dispatchStudents,
    rawRows,
  });
}
