import { NextResponse } from "next/server";
import { isAnyDriverRunToken } from "@/lib/shuttle/driverToken";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type OrderUpdateInput = {
  rowIds?: unknown;
  sortOrder?: unknown;
  arriveTime?: unknown;
};

function validDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return formatted === value ? value : null;
}

function serviceMonthFromDate(value: string): string {
  return value.slice(0, 7);
}

function validRowId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed) ? trimmed : null;
}

function validTime(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error("시간 형식이 올바르지 않습니다.");
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) throw new Error("시간은 HH:MM 형식이어야 합니다.");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) {
    throw new Error("시간 범위를 확인해 주세요.");
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseUpdates(raw: unknown): { rowIds: string[]; sortOrder: number; arriveTime: string | null }[] {
  if (!Array.isArray(raw)) throw new Error("저장할 순서 정보가 없습니다.");
  return raw.map((item: OrderUpdateInput, index) => {
    const rowIds = Array.isArray(item?.rowIds) ? item.rowIds.map(validRowId).filter((id): id is string => Boolean(id)) : [];
    if (rowIds.length === 0) throw new Error(`${index + 1}번째 정차의 저장 행이 없습니다.`);
    const sortOrder = Number(item?.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 1000) {
      throw new Error(`${index + 1}번째 정차 순서가 올바르지 않습니다.`);
    }
    return { rowIds: [...new Set(rowIds)], sortOrder, arriveTime: validTime(item?.arriveTime) };
  });
}

// 기사님 링크에서 정규 셔틀 카드 순서와 시간을 직접 저장한다.
// 탑승 체크 API처럼 토큰만 검증하고, 실제 변경은 표시 중인 월의 RegularShuttleStop 행에 한정한다.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { token?: unknown; date?: unknown; updates?: unknown } | null;
    const token = typeof body?.token === "string" ? body.token : "";
    const date = validDate(body?.date);
    if (!token || !date) return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
    if (!(await isAnyDriverRunToken(token))) return NextResponse.json({ error: "유효하지 않은 링크입니다." }, { status: 403 });

    const serviceMonth = serviceMonthFromDate(date);
    const updates = parseUpdates(body?.updates);
    let updated = 0;
    for (const item of updates) {
      const result = await prisma.regularShuttleStop.updateMany({
        where: { id: { in: item.rowIds }, serviceMonth },
        data: { sortOrder: item.sortOrder, arriveTime: item.arriveTime },
      });
      updated += result.count;
    }
    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    console.error("[shuttle/regular-order POST]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "저장하지 못했습니다." }, { status: 400 });
  }
}
