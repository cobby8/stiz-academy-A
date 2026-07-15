import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffClassAccess } from "@/lib/staff-class-access";
import { isValidPrivateSessionPhotoRef, parseStoredSessionPhotos } from "@/lib/sessionPhotoStorage";
import { requireAuth } from "@/lib/auth-guard";

type PhotoViewer = { kind: "STAFF" } | { kind: "PARENT"; studentIds: string[] };

async function requirePhotoViewer(classId: string, sessionStatus: string): Promise<PhotoViewer> {
  try {
    await requireStaffClassAccess(classId);
    return { kind: "STAFF" };
  } catch {
    const user = await requireAuth();
    if (sessionStatus !== "COMPLETED" || !user.email) throw new Error("사진 접근 권한이 없습니다.");
    const rows = await prisma.$queryRawUnsafe<Array<{ studentId: string }>>(
      `SELECT DISTINCT s.id AS "studentId"
       FROM "User" u
       JOIN "Student" s ON s."parentId" = u.id
       JOIN "Enrollment" e ON e."studentId" = s.id
       WHERE LOWER(u.email) = LOWER($1) AND e."classId" = $2 AND e.status = 'ACTIVE'`,
      user.email,
      classId,
    );
    if (!rows[0]) throw new Error("사진 접근 권한이 없습니다.");
    return { kind: "PARENT", studentIds: rows.map((row) => row.studentId) };
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
    const viewer = await requirePhotoViewer(session.classId, session.status);
    const drafts = await prisma.$queryRawUnsafe<Array<{ mediaJSON: string; subjectStudentIdsJSON: string }>>(
      `SELECT "mediaJSON", "subjectStudentIdsJSON" FROM "SocialPostDraft" WHERE "sessionId" = $1 ORDER BY "createdAt" DESC`,
      sessionId,
    );
    const matchedDraft = drafts.find((draft) => parseStoredSessionPhotos(draft.mediaJSON).some((item) => item.id === photoId));
    const photo = matchedDraft && parseStoredSessionPhotos(matchedDraft.mediaJSON).find((item) => item.id === photoId);
    if (!photo) return NextResponse.json({ error: "사진을 찾을 수 없습니다." }, { status: 404 });
    if (viewer.kind === "PARENT") {
      let subjectStudentIds: string[] = [];
      try {
        const parsed: unknown = JSON.parse(matchedDraft?.subjectStudentIdsJSON || "[]");
        if (Array.isArray(parsed)) {
          subjectStudentIds = [...new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0))];
        }
      } catch {
        subjectStudentIds = [];
      }
      if (subjectStudentIds.length === 0 || !subjectStudentIds.some((id) => viewer.studentIds.includes(id))) {
        throw new Error("사진 열람 동의를 확인할 수 없습니다.");
      }
      const consentRows = await prisma.$queryRawUnsafe<Array<{ studentId: string; internalAllowed: boolean; revokedAt: Date | null }>>(
        `SELECT subjects.id AS "studentId", latest."internalAllowed", latest."revokedAt"
           FROM unnest($1::text[]) subjects(id)
           LEFT JOIN LATERAL (
             SELECT c."internalAllowed", c."revokedAt"
               FROM "StudentMediaConsent" c
              WHERE c."studentId" = subjects.id
              ORDER BY c."recordedAt" DESC, c.id DESC
              LIMIT 1
           ) latest ON true`,
        subjectStudentIds,
      );
      if (consentRows.length !== subjectStudentIds.length
        || consentRows.some((row) => !row.internalAllowed || row.revokedAt !== null)) {
        throw new Error("사진 열람 동의를 확인할 수 없습니다.");
      }
    }
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
