import { normalizeSubjectStudentIds } from "@/lib/studentMediaConsentPolicy";
import { parseStoredSessionPhotos, type StoredSessionPhoto } from "@/lib/sessionPhotoStorage";
import { evaluatePhotoManagement } from "@/lib/sessionPhotoManagementPolicy";
import type { Prisma } from "@prisma/client";

export type SessionPhotoDraftRow = {
  id: string;
  status: string;
  mediaJSON: string;
  subjectStudentIdsJSON: string;
  galleryPostId: string | null;
  instagramMediaId: string | null;
};

export type ManagedSessionPhoto = StoredSessionPhoto & {
  draftId: string;
  subjectStudentIds: string[];
  canManage: boolean;
  requiresDeletionQueue: boolean;
};

export function listManagedSessionPhotos(rows: SessionPhotoDraftRow[]): ManagedSessionPhoto[] {
  return rows.flatMap((row) => {
    const subjectStudentIds = normalizeSubjectStudentIds(row.subjectStudentIdsJSON);
    return parseStoredSessionPhotos(row.mediaJSON).map((photo) => {
      const management = evaluatePhotoManagement({
        draftStatus: row.status,
        visibility: photo.visibility,
        hasPublishedCopy: "publishedStoragePath" in photo,
        hasGalleryPost: Boolean(row.galleryPostId),
        hasInstagramPost: Boolean(row.instagramMediaId),
      });
      return {
        ...photo,
        draftId: row.id,
        subjectStudentIds,
        ...management,
      };
    });
  });
}

export function findManagedSessionPhoto(rows: SessionPhotoDraftRow[], photoId: string) {
  return listManagedSessionPhotos(rows).find((photo) => photo.id === photoId) ?? null;
}

export function removePhotoFromMediaJSON(mediaJSON: string, photoId: string) {
  const photos = parseStoredSessionPhotos(mediaJSON);
  return JSON.stringify(photos.filter((photo) => photo.id !== photoId));
}

export function isEmptyMediaJSON(mediaJSON: string) {
  return parseStoredSessionPhotos(mediaJSON).length === 0;
}

export async function createSessionPhotoDraftInTransaction(
  tx: Prisma.TransactionClient,
  data: { authorUserId: string; authorName: string; authorRole: string; sessionId: string;
    classId: string; subjectStudentIds: string[]; photo: StoredSessionPhoto },
) {
  const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(`
    INSERT INTO "SocialPostDraft" (
      id, "authorUserId", "authorName", "authorRole", status, "mediaJSON", "isPublic",
      "sessionId", "classId", source, "subjectStudentIdsJSON", "submittedAt", "createdAt", "updatedAt"
    ) VALUES (gen_random_uuid()::text, $1, $2, $3, 'READY', $4, false,
      $5, $6, 'SESSION_PHOTO', $7, NOW(), NOW(), NOW()) RETURNING id
  `, data.authorUserId, data.authorName, data.authorRole, JSON.stringify([data.photo]),
  data.sessionId, data.classId, JSON.stringify(normalizeSubjectStudentIds(data.subjectStudentIds)));
  if (!rows[0]) throw new Error("사진 검토 초안을 만들지 못했습니다.");
  return rows[0].id;
}
