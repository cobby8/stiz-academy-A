import { prisma } from "@/lib/prisma";
import type { SocialPostDraft } from "@/lib/socialDrafts";
import {
  evaluateMediaConsent,
  type MediaConsentCheck,
  type MediaConsentRow,
  type MediaConsentScope,
} from "@/lib/studentMediaConsentPolicy";

export { evaluateMediaConsent } from "@/lib/studentMediaConsentPolicy";
export type { MediaConsentCheck, MediaConsentScope } from "@/lib/studentMediaConsentPolicy";

/** 게시 대상 학생 전원의 최신 동의를 읽으며, 누락이나 조회 오류는 공개 차단합니다. */
export async function checkSocialDraftMediaConsent(
  draft: Pick<SocialPostDraft, "sessionId" | "classId" | "subjectStudentIds">,
  scope: MediaConsentScope,
): Promise<MediaConsentCheck> {
  if ((!draft.sessionId && !draft.classId) || draft.subjectStudentIds.length === 0) {
    return { ok: false, scope, studentCount: 0, blockedStudents: [
      { id: "UNKNOWN", name: "학생 미지정", reason: "수업 연결 정보 없음" },
    ] };
  }

  try {
    const rows = await prisma.$queryRawUnsafe<MediaConsentRow[]>(
      `WITH requested AS (
         SELECT DISTINCT value AS id FROM jsonb_array_elements_text($3::jsonb)
       ), target_class AS (
         SELECT s."classId" FROM "Session" s
          WHERE s.id = $1 AND ($2::text IS NULL OR s."classId" = $2)
         UNION ALL
         SELECT $2::text WHERE $1::text IS NULL AND $2::text IS NOT NULL
       ), eligible_students AS (
         SELECT a."studentId" AS id
           FROM "Attendance" a
           JOIN target_class tc ON tc."classId" = (
             SELECT s."classId" FROM "Session" s WHERE s.id = a."sessionId"
           )
          WHERE a."sessionId" = $1
         UNION
         SELECT e."studentId" FROM "Enrollment" e
          WHERE e."classId" IN (SELECT "classId" FROM target_class) AND e.status = 'ACTIVE'
       ), latest_consent AS (
         SELECT DISTINCT ON (c."studentId") c."studentId", c."internalAllowed",
                c."galleryAllowed", c."instagramAllowed", c."revokedAt"
           FROM "StudentMediaConsent" c
          ORDER BY c."studentId", c."recordedAt" DESC, c.id DESC
       )
       SELECT q.id AS "studentId", COALESCE(s.name, '알 수 없는 학생') AS "studentName",
              COALESCE(c."internalAllowed", false) AS "internalAllowed",
              COALESCE(c."galleryAllowed", false) AS "galleryAllowed",
              COALESCE(c."instagramAllowed", false) AS "instagramAllowed", c."revokedAt",
              (e.id IS NOT NULL AND s.id IS NOT NULL) AS "isRelated"
         FROM requested q
         LEFT JOIN "Student" s ON s.id = q.id
         LEFT JOIN eligible_students e ON e.id = q.id
         LEFT JOIN latest_consent c ON c."studentId" = q.id
        ORDER BY s.name, q.id`,
      draft.sessionId ?? null,
      draft.classId ?? null,
      JSON.stringify(draft.subjectStudentIds),
    );
    if (rows.length === 0) {
      return { ok: false, scope, studentCount: 0, blockedStudents: [
        { id: "UNKNOWN", name: "학생 미확인", reason: "게시 대상 학생을 확인할 수 없음" },
      ] };
    }
    return evaluateMediaConsent(rows, scope);
  } catch (error) {
    console.error("[media-consent] fail-closed", {
      scope, sessionId: draft.sessionId, classId: draft.classId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, scope, studentCount: 0, blockedStudents: [
      { id: "SYSTEM", name: "동의 원장", reason: "동의 정보를 확인할 수 없음" },
    ] };
  }
}

export async function assertSocialDraftMediaConsent(
  draft: Pick<SocialPostDraft, "sessionId" | "classId" | "subjectStudentIds">,
  scope: MediaConsentScope,
) {
  const result = await checkSocialDraftMediaConsent(draft, scope);
  if (!result.ok) {
    const names = result.blockedStudents.slice(0, 3).map((student) => student.name).join(", ");
    throw new Error(`사진 공개 동의를 확인할 수 없습니다 (${names || "대상 미확인"}). 동의 상태를 확인해 주세요.`);
  }
  return result;
}
