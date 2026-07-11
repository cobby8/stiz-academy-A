import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { syncInstagramGalleryPostsToDb } from "@/lib/instagramGallerySync";

export const dynamic = "force-dynamic";

async function getInstagramBusinessAccountId() {
  const rows = await prisma.$queryRawUnsafe<Array<{ instagramBusinessAccountId: string | null }>>(
    `SELECT "instagramBusinessAccountId" AS "instagramBusinessAccountId"
     FROM "AcademySettings"
     WHERE id = 'singleton'
     LIMIT 1`,
  );

  return rows[0]?.instagramBusinessAccountId ?? null;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV !== "development") {
    if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await syncInstagramGalleryPostsToDb({
    businessAccountId: await getInstagramBusinessAccountId(),
    limit: 25,
  });

  if (result.ok) {
    revalidateTag("admin-gallery", { expire: 0 });
    revalidatePath("/admin/gallery");
    revalidatePath("/gallery");
    revalidatePath("/");
  }

  console.log(
    `[cron/instagram-gallery] ok=${result.ok} imported=${result.imported} skipped=${result.skipped} fetched=${result.fetched}`,
  );

  return NextResponse.json(
    {
      success: result.ok,
      ...result,
    },
    { status: result.ok ? 200 : 400 },
  );
}
