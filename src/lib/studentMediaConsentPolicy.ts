export type MediaConsentScope = "INTERNAL" | "GALLERY" | "INSTAGRAM";

export type MediaConsentRow = {
  studentId: string;
  studentName: string;
  internalAllowed: boolean;
  galleryAllowed: boolean;
  instagramAllowed: boolean;
  revokedAt: Date | string | null;
  isRelated: boolean;
};

export type MediaConsentCheck = {
  ok: boolean;
  scope: MediaConsentScope;
  studentCount: number;
  blockedStudents: Array<{ id: string; name: string; reason: string }>;
};

export function normalizeSubjectStudentIds(value: unknown) {
  let candidates: unknown = value;
  if (typeof value === "string") {
    try { candidates = JSON.parse(value); } catch { candidates = []; }
  }
  if (!Array.isArray(candidates)) return [];
  return [...new Set(candidates
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= 128 && /^[A-Za-z0-9_-]+$/.test(item)))]
    .slice(0, 100);
}

function hasScope(row: MediaConsentRow, scope: MediaConsentScope) {
  if (!row.isRelated) return false;
  if (row.revokedAt || !row.internalAllowed) return false;
  if (scope === "GALLERY" && !row.galleryAllowed) return false;
  if (scope === "INSTAGRAM" && (!row.galleryAllowed || !row.instagramAllowed)) return false;
  return true;
}

export function evaluateMediaConsent(
  rows: MediaConsentRow[],
  scope: MediaConsentScope,
): MediaConsentCheck {
  if (rows.length === 0) {
    return {
      ok: false,
      scope,
      studentCount: 0,
      blockedStudents: [{ id: "UNKNOWN", name: "학생 미확인", reason: "게시 대상 학생을 확인할 수 없음" }],
    };
  }
  const blockedStudents = rows.filter((row) => !hasScope(row, scope)).map((row) => ({
    id: row.studentId,
    name: row.studentName,
    reason: !row.isRelated ? "수업 또는 반 소속 불일치" : row.revokedAt ? "동의 철회" : `${scope} 공개 동의 없음`,
  }));
  return { ok: blockedStudents.length === 0, scope, studentCount: rows.length, blockedStudents };
}
