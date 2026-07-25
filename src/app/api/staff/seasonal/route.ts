import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth-guard";
import { getSeasonalDatesForStaff, getDateRoster, setSeasonalAttendance } from "@/lib/seasonal/attendance";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let staff;
  try { staff = await requireStaff(); } catch { return NextResponse.json({ error: "권한이 필요합니다." }, { status: 401 }); }

  const { searchParams } = request.nextUrl;
  const sessionDateId = searchParams.get("sessionDateId");
  try {
    if (sessionDateId) {
      return NextResponse.json(await getDateRoster(sessionDateId), { headers: { "Cache-Control": "no-store" } });
    }
    const ymd = searchParams.get("date");
    const data = await getSeasonalDatesForStaff(staff.appUserId, staff.appUserRole, ymd);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/staff/seasonal] GET failed:", error);
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let staff;
  try { staff = await requireStaff(); } catch { return NextResponse.json({ error: "권한이 필요합니다." }, { status: 401 }); }

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid body" }, { status: 400 }); }
  if (body?.action !== "attendance" || !body.enrollmentDateId) {
    return NextResponse.json({ error: "enrollmentDateId required" }, { status: 400 });
  }
  try {
    const result = await setSeasonalAttendance(body.enrollmentDateId, body.status ?? null, {
      note: body.note ?? null, arrivedAt: body.arrivedAt ?? null, userId: staff.appUserId,
    });
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code !== "INVALID_ATTENDANCE_STATUS") console.error("[api/staff/seasonal] POST failed:", error);
    return NextResponse.json({ error: code === "INVALID_ATTENDANCE_STATUS" ? "출결 값이 올바르지 않습니다." : "처리에 실패했습니다." }, { status: 500 });
  }
}
