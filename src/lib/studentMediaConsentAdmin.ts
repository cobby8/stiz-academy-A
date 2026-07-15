import { prisma } from "@/lib/prisma";

export const STUDENT_MEDIA_POLICY_VERSION = "2026-07-media-v1";

export type StudentMediaConsentAdminView = {
  student: { id: string; name: string; guardianUserId: string; guardianName: string | null; guardianPhone: string | null };
  latest: {
    id: string;
    internalAllowed: boolean;
    galleryAllowed: boolean;
    instagramAllowed: boolean;
    policyVersion: string;
    evidence: { method?: string; guardianName?: string; note?: string } | null;
    recordedAt: Date;
    revokedAt: Date | null;
  } | null;
  history: Array<{
    id: string;
    internalAllowed: boolean;
    galleryAllowed: boolean;
    instagramAllowed: boolean;
    policyVersion: string;
    evidence: { method?: string; guardianName?: string; note?: string } | null;
    recordedAt: Date;
    revokedAt: Date | null;
  }>;
};

type ConsentRow = Omit<StudentMediaConsentAdminView["history"][number], "evidence"> & { evidenceJSON: string | null };

function parseEvidence(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export async function getStudentMediaConsentAdminView(studentId: string): Promise<StudentMediaConsentAdminView | null> {
  const students = await prisma.$queryRaw<Array<{
    id: string;
    name: string;
    guardianUserId: string;
    guardianName: string | null;
    guardianPhone: string | null;
  }>>`
    SELECT s.id, s.name, s."parentId" AS "guardianUserId", u.name AS "guardianName", u.phone AS "guardianPhone"
    FROM "Student" s
    JOIN "User" u ON u.id = s."parentId"
    WHERE s.id = ${studentId}
    LIMIT 1
  `;
  if (!students[0]) return null;

  const rows = await prisma.$queryRaw<ConsentRow[]>`
    SELECT id, "internalAllowed", "galleryAllowed", "instagramAllowed", "policyVersion",
           "evidenceJSON", "recordedAt", "revokedAt"
    FROM "StudentMediaConsent"
    WHERE "studentId" = ${studentId}
    ORDER BY "recordedAt" DESC, id DESC
    LIMIT 20
  `;
  const history = rows.map(({ evidenceJSON, ...row }) => ({ ...row, evidence: parseEvidence(evidenceJSON) }));

  return { student: students[0], latest: history[0] ?? null, history };
}

