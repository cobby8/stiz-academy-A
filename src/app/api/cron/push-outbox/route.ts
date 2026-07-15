import { NextRequest, NextResponse } from "next/server";
import { processPushOutbox } from "@/lib/push-outbox";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await processPushOutbox(50);
  console.log(`[cron/push-outbox] processed=${result.processed} sent=${result.sent} partial=${result.partial} skipped=${result.skipped} retry=${result.retried} failed=${result.failed}`);
  return NextResponse.json({ success: result.failed === 0, ...result });
}
