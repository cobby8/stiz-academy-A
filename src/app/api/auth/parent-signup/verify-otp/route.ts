import { NextResponse } from "next/server";
import { verifyParentSignupOtp } from "@/lib/parent-signup-verification";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: unknown; challengeToken?: unknown; code?: unknown; otp?: unknown } | null;
  const result = await verifyParentSignupOtp(
    String(body?.challengeToken || body?.token || ""),
    String(body?.otp || body?.code || ""),
  );
  return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
}
