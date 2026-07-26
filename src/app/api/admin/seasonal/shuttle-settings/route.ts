import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

// 셔틀 기준 위치(학원·차고지·1호점 무료 탑승 거점) 편집 저장.
// 지도에서 고른 좌표/주소를 AcademySettings 컬럼에 반영한다. 관리자만.
const COLS: Record<string, { lat: string; lng: string; addr: string; name?: string }> = {
  academy: { lat: "academyLatitude", lng: "academyLongitude", addr: "academyAddress" },
  depot: { lat: "shuttleDepotLatitude", lng: "shuttleDepotLongitude", addr: "shuttleDepotAddress" },
  hub: { lat: "shuttleHubLatitude", lng: "shuttleHubLongitude", addr: "shuttleHubAddress", name: "shuttleHubName" },
};

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => null) as
      { kind?: string; latitude?: number; longitude?: number; address?: string; name?: string } | null;
    const map = body?.kind ? COLS[body.kind] : undefined;
    const lat = Number(body?.latitude), lng = Number(body?.longitude);
    if (!map || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: "위치 정보가 올바르지 않습니다." }, { status: 400 });
    }
    const address = typeof body?.address === "string" ? body.address.trim().slice(0, 300) : null;
    const sets: string[] = [`"${map.lat}" = $1`, `"${map.lng}" = $2`, `"${map.addr}" = $3`];
    const args: unknown[] = [lat, lng, address];
    if (map.name && typeof body?.name === "string" && body.name.trim()) {
      args.push(body.name.trim().slice(0, 80));
      sets.push(`"${map.name}" = $${args.length}`);
    }
    // AcademySettings는 단일 행 — id 조건 없이 전체 업데이트(행 1개 가정).
    await prisma.$executeRawUnsafe(`UPDATE "AcademySettings" SET ${sets.join(", ")}`, ...args);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[shuttle-settings POST]", e);
    return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  }
}
