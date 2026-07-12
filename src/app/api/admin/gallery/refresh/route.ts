import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

function refreshGalleryCaches() {
  revalidateTag("admin-gallery", { expire: 0 });
  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  revalidatePath("/mypage");
  revalidatePath("/");
}

export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  refreshGalleryCaches();

  return NextResponse.json(
    { ok: true, refreshedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
