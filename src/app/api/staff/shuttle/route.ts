import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth-guard";
import { ShuttleServiceError, updatePassengerRideStatus } from "@/lib/shuttle/service";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function PATCH(request: NextRequest) {
  try {
    const staff = await requireStaff();
    const body = object(await request.json());
    const routeId = typeof body.routeId === "string" ? body.routeId : "";
    const passengerId = typeof body.passengerId === "string" ? body.passengerId : "";
    if (!routeId || !passengerId) {
      throw new ShuttleServiceError("노선과 학생 정보를 확인해 주세요.", 400, "RIDE_STATUS_TARGET_REQUIRED");
    }
    const passenger = await updatePassengerRideStatus(staff, routeId, passengerId, body.status);
    return NextResponse.json({ passenger });
  } catch (error) {
    if (error instanceof ShuttleServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[staff shuttle]", error);
    return NextResponse.json({ error: "셔틀 상태를 저장하지 못했습니다.", code: "SHUTTLE_RIDE_STATUS_FAILED" }, { status: 500 });
  }
}
