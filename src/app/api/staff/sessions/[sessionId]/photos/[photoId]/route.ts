import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffClassAccess } from "@/lib/staff-class-access";
import { isValidPrivateSessionPhotoRef, parseStoredSessionPhotos } from "@/lib/sessionPhotoStorage";
import { requireAuth } from "@/lib/auth-guard";

async function requirePhotoViewer(classId: string, sessionStatus: string) {
  try {
    await requireStaffClassAccess(classId);
    return;
  } catch {
    const user = await requireAuth();
    if (sessionStatus !== "COMPLETED" || !user.email) throw new Error("사진 접근 권한이 없습니다.");
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT u.id
       FROM "User" u
       JOIN "Student" s ON s."parentId" = u.id
       JOIN "Enrollment" e ON e."studentId" = s.id
       WHERE LOWER(u.email) = LOWER($1) AND e."classId" = $2 AND e.status = 'ACTIVE'
       LIMIT 1`,
      user.email,
      classId,
    );
    if (!rows[0]) throw new Error("사진 접근 권한이 없습니다.");
  }
}

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string; photoId: string }> }) {
  try {
    const { sessionId, photoId } = await context.params;
    const rows = await prisma.$queryRawUnsafe<Array<{ classId: string; status: string }>>(
      `SELECT "classId", status FROM "Session" WHERE id = $1 LIMIT 1`,
      sessionId,
    );
    const session = rows[0];
    if (!session) return NextResponse.json({ error: "수업 기록을 찾을 수 없습니다." }, { status: 404 });
    await requirePhotoViewer(session.classId, session.status);
    const drafts = await prisma.$queryRawUnsafe<Array<{ mediaJSON: string }>>(
      `SELECT "mediaJSON" FROM "SocialPostDraft" WHERE "sessionId" = $1 ORDER BY "createdAt" DESC`,
      sessionId,
    );
    const photo = drafts.flatMap((draft) => parseStoredSessionPhotos(draft.mediaJSON)).find((item) => item.id === photoId);
    if (!photo) return NextResponse.json({ error: "사진을 찾을 수 없습니다." }, { status: 404 });
    if (!isValidPrivateSessionPhotoRef(photo as unknown as Record<string, unknown>, { classId: session.classId, sessionId })) {
      return NextResponse.json({ error: "사진 경로가 올바르지 않습니다." }, { status: 400 });
    }

    const { data, error } = await createAdminClient().storage.from(photo.storageBucket).download(photo.storagePath);
    if (error || !data) return NextResponse.json({ error: "사진을 불러오지 못했습니다." }, { status: 404 });
    return new Response(await data.arrayBuffer(), {
      headers: {
        "Content-Type": data.type || "image/jpeg",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "사진 접근 권한이 없습니다." }, { status: 403 });
  }
}
