import { NextResponse } from "next/server";
import { completeParentSignup } from "@/lib/parent-signup-verification";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "입력값을 확인해 주세요." }, { status: 400 });
  const { data } = await (await createClient()).auth.getUser();
  const provider = String(data.user?.app_metadata?.provider || data.user?.identities?.[0]?.provider || "").toLowerCase() || null;
  const result = await completeParentSignup({
    token: String(body.challengeToken || body.token || ""),
    proof: String(body.proof || ""),
    username: String(body.username || ""),
    name: String(body.name || ""),
    password: typeof body.password === "string" ? body.password : undefined,
    enrollmentHandoff: typeof body.handoff === "string"
      ? body.handoff
      : typeof body.enrollmentHandoff === "string"
        ? body.enrollmentHandoff
        : null,
    consents: {
      terms: Boolean((body.consents as Record<string, unknown> | undefined)?.terms),
      privacy: Boolean((body.consents as Record<string, unknown> | undefined)?.privacy),
      age: Boolean((body.consents as Record<string, unknown> | undefined)?.age),
    },
    authenticatedOAuthUser: data.user ? { id: data.user.id, email: data.user.email, provider } : null,
  });
  return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
}
