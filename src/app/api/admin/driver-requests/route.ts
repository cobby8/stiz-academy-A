import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { setConfirmedShuttleRideByRequestId } from "@/lib/seasonal/shuttleRoster";

export const dynamic = "force-dynamic";

export type DriverRequestRow = {
  id: string;
  token: string;
  serviceDate: string;
  type: string;
  targetId: string | null;
  targetName: string | null;
  note: string | null;
  payload: unknown;
  status: string;
  resolvedAt: string | null;
  createdAt: string;
};

// 관리자 전용 — 기사 요청 목록 (최근 7일, 최대 100건)
export async function GET() {
  try {
    await requireAdmin();

    const rows = await prisma.$queryRawUnsafe<DriverRequestRow[]>(
      `SELECT id, token, "serviceDate", type, "targetId", "targetName", note, payload, status,
              "resolvedAt"::text, "createdAt"::text
       FROM "DriverRequest"
       WHERE "createdAt" > now() - INTERVAL '7 days'
       ORDER BY
         CASE status WHEN 'PENDING' THEN 0 ELSE 1 END,
         "createdAt" DESC
       LIMIT 100`,
    );

    return NextResponse.json(
      { requests: rows },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[admin/driver-requests GET]", e);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

// 승인·거절 처리 — type에 따라 자동으로 명단·노선을 수정한다
export async function PATCH(request: Request) {
  try {
    const { appUserId } = await requireAdmin();

    const body = await request.json().catch(() => null) as {
      id?: string; action?: "approve" | "reject";
    } | null;

    const { id, action } = body ?? {};
    if (!id || !action) {
      return NextResponse.json({ error: "id, action 필수" }, { status: 400 });
    }

    // 요청 상세 조회
    const reqs = await prisma.$queryRawUnsafe<DriverRequestRow[]>(
      `SELECT * FROM "DriverRequest" WHERE id = $1 LIMIT 1`,
      id,
    );
    if (!reqs.length) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
    const req = reqs[0];
    if (req.status !== "PENDING") return NextResponse.json({ error: "이미 처리된 요청입니다." }, { status: 409 });

    // 승인 시 type별 자동 처리
    if (action === "approve") {
      if (req.type === "REMOVE" && req.targetId) {
        // 학생 제외 — 확정 명단에서 soft-remove
        await setConfirmedShuttleRideByRequestId(req.targetId, false);
      } else if (req.type === "ORDER" && req.payload && req.targetId) {
        // 순서 고정 — SeasonalDispatchRoute payload 업데이트
        await applyOrderChange(req);
      }
      // LOCATION, OTHER — 관리자가 수동으로 처리한 것으로 간주. 상태만 승인으로 변경.
    }

    // 상태 업데이트
    const newStatus = action === "approve" ? "APPROVED" : "REJECTED";
    await prisma.$executeRawUnsafe(
      `UPDATE "DriverRequest" SET status = $2, "resolvedAt" = now(), "resolvedByUserId" = $3 WHERE id = $1`,
      id, newStatus, appUserId ?? null,
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/driver-requests PATCH]", e);
    const msg = String((e as { message?: string })?.message ?? "");
    if (/권한|원장|Unauthorized|Forbidden/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    return NextResponse.json({ error: "처리 실패" }, { status: 500 });
  }
}

// ORDER 승인: SeasonalDispatchRoute.payload 내 해당 차량의 stops를 새 순서로 교체
async function applyOrderChange(req: DriverRequestRow) {
  const [direction, vehicleIdxStr] = String(req.targetId).split(":");
  const vehicleIdx = parseInt(vehicleIdxStr ?? "0", 10);
  const newStops = req.payload as unknown[];
  if (!direction || !Array.isArray(newStops)) return;

  const routes = await prisma.$queryRawUnsafe<{ id: string; payload: unknown }[]>(
    `SELECT id, payload FROM "SeasonalDispatchRoute" WHERE "serviceDate" = $1 AND direction = $2 LIMIT 1`,
    req.serviceDate, direction,
  );
  if (!routes.length) return;

  const route = routes[0];
  const payload = route.payload as { vehicles?: { stops?: unknown[] }[] } | null;
  if (!payload?.vehicles) return;

  const updated = { ...payload };
  updated.vehicles = payload.vehicles.map((v, i) =>
    i === vehicleIdx ? { ...v, stops: newStops } : v,
  );

  await prisma.$executeRawUnsafe(
    `UPDATE "SeasonalDispatchRoute" SET payload = $2::jsonb, "updatedAt" = now() WHERE id = $1`,
    route.id, JSON.stringify(updated),
  );
}
