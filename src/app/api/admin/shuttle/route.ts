import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth-guard";
import { classifyAdminAuthError } from "@/app/api/admin/seasonal/auth-error";
import {
  archiveRoute,
  completeRoute,
  assignPassenger,
  confirmRoute,
  createRoute,
  createVehicle,
  getShuttleDashboard,
  previewOptimizedRouteStops,
  reorderStops,
  reviseRoute,
  ShuttleServiceError,
  unassignPassenger,
  updateRoute,
  updateShuttleRequestLocation,
  updateVehicle,
} from "@/lib/shuttle/service";

function errorResponse(error: unknown) {
  if (error instanceof ShuttleServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2002")) {
    return NextResponse.json(
      { error: "다른 관리자가 먼저 변경했습니다. 최신 내용을 불러온 뒤 다시 시도해 주세요.", code: "SHUTTLE_CONCURRENT_UPDATE" },
      { status: 409 },
    );
  }
  const auth = classifyAdminAuthError(error);
  if (auth) return NextResponse.json({ error: auth.message, code: auth.code }, { status: auth.status });
  console.error("[admin shuttle]", error);
  return NextResponse.json({ error: "셔틀 관리 작업을 완료하지 못했습니다.", code: "SHUTTLE_OPERATION_FAILED" }, { status: 500 });
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    return NextResponse.json(await getShuttleDashboard(
      request.nextUrl.searchParams.get("seasonId") || undefined,
      request.nextUrl.searchParams.get("direction") || undefined,
      request.nextUrl.searchParams.get("serviceDate") || undefined,
    ));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const body = object(await request.json());
    const data = object(body.data);
    if (body.resource === "vehicle") return NextResponse.json({ vehicle: await createVehicle(actor, data) }, { status: 201 });
    if (body.resource === "route") return NextResponse.json({ route: await createRoute(actor, data) }, { status: 201 });
    throw new ShuttleServiceError("지원하지 않는 생성 요청입니다.", 400, "UNSUPPORTED_RESOURCE");
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const body = object(await request.json());
    const data = object(body.data);
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) throw new ShuttleServiceError("수정할 항목 ID가 필요합니다.", 400, "ID_REQUIRED");
    if (body.resource === "vehicle") return NextResponse.json({ vehicle: await updateVehicle(actor, id, data) });
    if (body.resource === "shuttleRequest") {
      if (body.action !== "confirmLocation") throw new ShuttleServiceError("지원하지 않는 셔틀 신청 작업입니다.", 400, "UNSUPPORTED_ACTION");
      return NextResponse.json({ request: await updateShuttleRequestLocation(actor, id, data) });
    }
    if (body.resource !== "route") throw new ShuttleServiceError("지원하지 않는 수정 요청입니다.", 400, "UNSUPPORTED_RESOURCE");
    let route;
    switch (body.action) {
      case "update": route = await updateRoute(actor, id, data); break;
      case "optimizePreview": return NextResponse.json({ preview: await previewOptimizedRouteStops(actor, id) });
      case "assign": route = await assignPassenger(actor, id, data); break;
      case "unassign": route = await unassignPassenger(actor, id, data); break;
      case "reorder": route = await reorderStops(actor, id, data); break;
      case "confirm": route = await confirmRoute(actor, id); break;
      case "complete": route = await completeRoute(actor, id); break;
      case "archive": route = await archiveRoute(actor, id); break;
      case "revise": route = await reviseRoute(actor, id); break;
      default: throw new ShuttleServiceError("지원하지 않는 노선 작업입니다.", 400, "UNSUPPORTED_ACTION");
    }
    return NextResponse.json({ route });
  } catch (error) {
    return errorResponse(error);
  }
}
