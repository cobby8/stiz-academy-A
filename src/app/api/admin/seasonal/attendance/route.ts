import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import {
  getSeasonalAttendanceBootstrap,
  getOfferingDateBoard,
  getDateRoster,
  setSeasonalAttendance,
} from "@/lib/seasonal/attendance";
import { getMakeupOptions, createMakeup, decideMakeup, listMakeups } from "@/lib/seasonal/makeup";

export const dynamic = "force-dynamic";

async function guard() {
  try {
    return await requireAdmin();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const admin = await guard();
  if (!admin) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const view = searchParams.get("view") || "bootstrap";
  try {
    if (view === "bootstrap") {
      return NextResponse.json(await getSeasonalAttendanceBootstrap(), { headers: { "Cache-Control": "no-store" } });
    }
    if (view === "board") {
      const offeringId = searchParams.get("offeringId");
      if (!offeringId) return NextResponse.json({ error: "offeringId required" }, { status: 400 });
      return NextResponse.json(await getOfferingDateBoard(offeringId), { headers: { "Cache-Control": "no-store" } });
    }
    if (view === "roster") {
      const sessionDateId = searchParams.get("sessionDateId");
      if (!sessionDateId) return NextResponse.json({ error: "sessionDateId required" }, { status: 400 });
      return NextResponse.json(await getDateRoster(sessionDateId), { headers: { "Cache-Control": "no-store" } });
    }
    if (view === "makeup-options") {
      const enrollmentDateId = searchParams.get("enrollmentDateId");
      if (!enrollmentDateId) return NextResponse.json({ error: "enrollmentDateId required" }, { status: 400 });
      return NextResponse.json(await getMakeupOptions(enrollmentDateId), { headers: { "Cache-Control": "no-store" } });
    }
    if (view === "makeups") {
      const seasonId = searchParams.get("seasonId");
      return NextResponse.json(await listMakeups(seasonId), { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "unknown view" }, { status: 400 });
  } catch (error) {
    console.error("[api/admin/seasonal/attendance] GET failed:", error);
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await guard();
  if (!admin) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const userId = admin.appUserId ?? null;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const action = body?.action as string | undefined;

  try {
    if (action === "attendance") {
      if (!body.enrollmentDateId) return NextResponse.json({ error: "enrollmentDateId required" }, { status: 400 });
      const result = await setSeasonalAttendance(body.enrollmentDateId, body.status ?? null, {
        note: body.note ?? null, arrivedAt: body.arrivedAt ?? null, userId,
      });
      return NextResponse.json(result);
    }
    if (action === "makeup-create") {
      const result = await createMakeup({
        enrollmentDateId: body.enrollmentDateId,
        targetType: body.targetType,
        targetSessionDateId: body.targetSessionDateId ?? null,
        targetClassId: body.targetClassId ?? null,
        targetDate: body.targetDate ?? null,
        requestedBy: "ADMIN",
        userId,
        note: body.note ?? null,
      });
      return NextResponse.json(result);
    }
    if (action === "makeup-decide") {
      if (!body.makeupId || !body.decision) return NextResponse.json({ error: "makeupId/decision required" }, { status: 400 });
      const result = await decideMakeup(body.makeupId, body.decision, userId);
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const map: Record<string, string> = {
      MAKEUP_ALREADY_EXISTS: "이미 보강이 배정된 결석입니다.",
      TARGET_FULL: "선택한 날짜는 정원이 찼습니다.",
      TARGET_ALREADY_ENROLLED: "그 날은 원래 수업이 있는 날입니다. 다른 날짜를 선택해 주세요.",
      TARGET_NOT_IN_OFFERING: "같은 특강의 날짜만 보강으로 선택할 수 있습니다.",
      TARGET_SESSION_DATE_REQUIRED: "보강 대상 날짜를 선택하세요.",
      ABSENCE_NOT_FOUND: "결석 정보를 찾을 수 없습니다.",
      INVALID_ATTENDANCE_STATUS: "출결 값이 올바르지 않습니다.",
    };
    const known = map[code];
    if (!known) console.error("[api/admin/seasonal/attendance] POST failed:", error);
    return NextResponse.json({ error: known || "처리에 실패했습니다." }, { status: known ? 409 : 500 });
  }
}
