import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { runSiteOpsBot } from "@/lib/siteOpsBot";

export const dynamic = "force-dynamic";

export async function POST() {
  let admin;

  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const result = await runSiteOpsBot(admin);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/admin/site-ops-bot] failed:", error);
    return NextResponse.json({ error: "Failed to run site ops bot" }, { status: 500 });
  }
}
