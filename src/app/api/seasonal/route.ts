import { NextResponse } from "next/server";
import { listPublishedSeasons } from "@/lib/seasonal/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const seasons = await listPublishedSeasons();
  return NextResponse.json({ seasons }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}

