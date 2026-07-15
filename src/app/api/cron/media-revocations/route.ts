import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { processMediaRevocationQueue } from "@/lib/mediaRevocationQueue";
import { processSessionPhotoDeletionQueue } from "@/lib/sessionPhotoDeletionQueue";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV !== "development"
    && (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [result, photoDeletion] = await Promise.all([
    processMediaRevocationQueue(20),
    processSessionPhotoDeletionQueue(20),
  ]);
  if (result.removed > 0) {
    revalidatePath("/admin/gallery");
    revalidatePath("/gallery");
    revalidatePath("/");
  }
  return NextResponse.json({ success: result.failed === 0, ...result, photoDeletion });
}
