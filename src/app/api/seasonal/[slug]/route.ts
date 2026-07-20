import { NextResponse } from "next/server";
import { SeasonalError } from "@/lib/seasonal/contracts";
import { getPublishedSeason } from "@/lib/seasonal/service";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    return NextResponse.json(await getPublishedSeason(slug), { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } });
  } catch (error) {
    if (error instanceof SeasonalError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error("[seasonal detail]", error);
    return NextResponse.json({ error: "방학특강을 불러오지 못했습니다." }, { status: 500 });
  }
}

