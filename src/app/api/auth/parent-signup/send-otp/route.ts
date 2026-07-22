import { NextResponse } from "next/server";
import { sendParentSignupOtp } from "@/lib/parent-signup-verification";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: unknown } | null;
  const result = await sendParentSignupOtp(String(body?.token || ""));
  return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
}
