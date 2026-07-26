import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth-guard";
import { getDateRoster, setSeasonalAttendance } from "@/lib/seasonal/attendance";
import { getKoreaDateKey, getTodayStaffClasses } from "@/lib/staff-session-queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // 인증 확인만 필요(대상자 조회는 getTodayStaffClasses가 로그인 컨텍스트로 접근권한을 판정)
  try { await requireStaff(); } catch { return NextResponse.json({ error: "권한이 필요합니다." }, { status: 401 }); }

  const { searchParams } = request.nextUrl;
  const sessionDateId = searchParams.get("sessionDateId");
  try {
    if (sessionDateId) {
      return NextResponse.json(await getDateRoster(sessionDateId), { headers: { "Cache-Control": "no-store" } });
    }
    // 버그#2: 날짜 이동 시에도 홈과 동일한 반 단위 seasonal 목록을 반환한다.
    const ymd = searchParams.get("date") || getKoreaDateKey();
    const classes = await getTodayStaffClasses(ymd);
    const seasonal = classes.filter((c) => c.kind === "SEASONAL");
    return NextResponse.json({ ymd, classes: seasonal }, { headers: { "Cache-Control": "no-store" } });
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
