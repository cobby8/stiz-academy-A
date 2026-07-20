import { NextResponse } from "next/server";
import { parseApplicationInput, SeasonalError } from "@/lib/seasonal/contracts";
import { submitSeasonalApplication } from "@/lib/seasonal/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const input = parseApplicationInput(await request.json());
    const result = await submitSeasonalApplication(slug, input);
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    if (error instanceof SeasonalError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error("[seasonal application]", error);
    return NextResponse.json({ error: "신청을 저장하지 못했습니다." }, { status: 500 });
  }
}

