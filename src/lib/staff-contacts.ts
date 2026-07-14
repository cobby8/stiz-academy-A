import { prisma } from "@/lib/prisma";
import { requireStaffClassAccess } from "@/lib/staff-class-access";

export function normalizePhoneNumber(value: string | null) {
  return value?.replace(/\D/g, "") || null;
}

export async function getStaffClassContacts(classId: string) {
  await requireStaffClassAccess(classId);
  const rows = await prisma.$queryRawUnsafe<Array<{
    studentId: string; studentName: string; studentPhone: string | null;
    parentId: string; parentName: string; parentPhone: string | null;
    guardianId: string | null; guardianName: string | null; guardianRelation: string | null;
    guardianPhone: string | null; guardianIsPrimary: boolean | null;
  }>>(
    `SELECT s.id AS "studentId", s.name AS "studentName", s.phone AS "studentPhone",
            p.id AS "parentId", p.name AS "parentName", p.phone AS "parentPhone",
            g.id AS "guardianId", g.name AS "guardianName", g.relation AS "guardianRelation",
            g.phone AS "guardianPhone", g."isPrimary" AS "guardianIsPrimary"
     FROM "Enrollment" e
     JOIN "Student" s ON s.id = e."studentId"
     JOIN "User" p ON p.id = s."parentId"
     LEFT JOIN "Guardian" g ON g."studentId" = s.id
     WHERE e."classId" = $1 AND e.status = 'ACTIVE'
     ORDER BY s.name, g."isPrimary" DESC NULLS LAST, g.name`,
    classId,
  );
  return rows.map((row) => ({
    ...row,
    studentPhone: normalizePhoneNumber(row.studentPhone),
    parentPhone: normalizePhoneNumber(row.parentPhone),
    guardianPhone: normalizePhoneNumber(row.guardianPhone),
  }));
}
