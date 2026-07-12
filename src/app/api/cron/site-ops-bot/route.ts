import { NextRequest, NextResponse } from "next/server";
import { runSiteOpsBot } from "@/lib/siteOpsBot";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV !== "development") {
    if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runSiteOpsBot("cron");

    console.log(
      `[cron/site-ops-bot] ok=${result.ok} fixed=${result.fixedCount} manual=${result.manualActionCount} critical=${result.criticalCount} notified=${result.notified}`,
    );

    return NextResponse.json({
      success: result.ok,
      ...result,
    });
  } catch (error) {
    console.error("[cron/site-ops-bot] failed:", error);
    return NextResponse.json({ error: "Failed to run site ops bot" }, { status: 500 });
  }
}
