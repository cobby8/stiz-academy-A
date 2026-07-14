import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffClassAccess } from "@/lib/staff-class-access";
import { createSocialPostDraftRecord } from "@/lib/socialDrafts";
import {
  ensurePrivateSessionPhotoBucket,
  parseSessionPhotoEntries,
  PRIVATE_SESSION_PHOTO_BUCKET,
  type StoredSessionPhoto,
} from "@/lib/sessionPhotoStorage";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 1024 * 1024;

export async function POST(req: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await context.params;
    const sessions = await prisma.$queryRawUnsafe<Array<{ id: string; classId: string; status: string; photosJSON: string | null }>>(
      `SELECT id, "classId", status, "photosJSON" FROM "Session" WHERE id = $1 LIMIT 1`, sessionId,
    );
    const session = sessions[0];
    if (!session) return NextResponse.json({ error: "수업 기록을 찾을 수 없습니다." }, { status: 404 });
    const access = await requireStaffClassAccess(session.classId);
    if (session.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "진행 중인 수업에만 사진을 등록할 수 있습니다." }, { status: 409 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "사진을 선택해 주세요." }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type) || file.type === "image/gif") {
      return NextResponse.json({ error: "수업 사진은 JPEG, PNG, WebP만 사용할 수 있습니다." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "압축된 사진은 1MB 이하여야 합니다." }, { status: 400 });

    // API 직접 호출도 GPS/기기 EXIF를 남기지 못하도록 서버에서 다시 인코딩합니다.
    const encoded = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    if (encoded.byteLength > MAX_BYTES) return NextResponse.json({ error: "사진 압축 결과가 1MB를 초과했습니다." }, { status: 400 });
    const ext = "jpg";
    const photoId = randomUUID();
    const storagePath = `staff-sessions/${session.classId}/${sessionId}/${photoId}.${ext}`;
    const supabase = createAdminClient();
    const bucket = PRIVATE_SESSION_PHOTO_BUCKET;
    await ensurePrivateSessionPhotoBucket();
    const { error: uploadError } = await supabase.storage.from(bucket).upload(
      storagePath, encoded,
      { contentType: "image/jpeg", cacheControl: "31536000", upsert: false },
    );
    if (uploadError) throw new Error("사진 저장소 업로드에 실패했습니다.");
    const url = `/api/staff/sessions/${sessionId}/photos/${photoId}`;
    const storedPhoto: StoredSessionPhoto = {
      id: photoId,
      type: "image",
      url,
      storageBucket: bucket,
      storagePath,
      visibility: "PRIVATE",
    };

    try {
      await prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRawUnsafe<Array<{ photosJSON: string | null }>>(
          `SELECT "photosJSON" FROM "Session" WHERE id = $1 FOR UPDATE`, sessionId,
        );
        const photos = parseSessionPhotoEntries(locked[0]?.photosJSON);
        if (!photos.some((photo) => photo === url)) photos.push(url);
        await tx.$executeRawUnsafe(
          `UPDATE "Session" SET "photosJSON" = $1, "updatedAt" = NOW() WHERE id = $2`,
          JSON.stringify(photos), sessionId,
        );
      });
      await createSocialPostDraftRecord({
        authorUserId: access.staff.appUserId,
        authorName: access.staff.appUserName,
        authorRole: access.staff.appUserRole,
        mediaJSON: JSON.stringify([storedPhoto]),
        isPublic: false,
        sessionId,
        classId: session.classId,
        source: "SESSION_PHOTO",
      });
    } catch (error) {
      // 외부 저장소와 DB는 한 번에 묶을 수 없으므로 실패 시 방금 URL을 되돌립니다.
      await prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRawUnsafe<Array<{ photosJSON: string | null }>>(
          `SELECT "photosJSON" FROM "Session" WHERE id = $1 FOR UPDATE`, sessionId,
        );
        const photos = parseSessionPhotoEntries(locked[0]?.photosJSON).filter((photo) => photo !== url);
        await tx.$executeRawUnsafe(
          `UPDATE "Session" SET "photosJSON" = $1, "updatedAt" = NOW() WHERE id = $2`,
          JSON.stringify(photos), sessionId,
        );
      }).catch(() => undefined);
      await supabase.storage.from(bucket).remove([storagePath]).catch(() => undefined);
      throw error;
    }

    return NextResponse.json({ url, type: "image", reviewStatus: "READY" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "사진 등록에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: message.includes("권한") ? 403 : 500 });
  }
}
