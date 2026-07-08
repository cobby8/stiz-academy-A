import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { processSocialPostPublishQueue } from "@/lib/socialPostPublishing";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV !== "development") {
    if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await processSocialPostPublishQueue(1);

  if (result.processed > 0) {
    revalidatePath("/admin/gallery");
    revalidatePath("/staff/quick-post");
    revalidatePath("/gallery");
    revalidatePath("/mypage");
    revalidatePath("/");
  }

  console.log(
    `[cron/social-posts] processed=${result.processed} succeeded=${result.succeeded} retry=${result.retryScheduled} failed=${result.failed}`,
  );

  return NextResponse.json({
    success: result.ok,
    ...result,
  });
}
