import { prisma } from "@/lib/prisma";
import { getAccessibleClassIds, getStaffClassAccessContext } from "@/lib/staff-class-access";
import { normalizePhoneNumber } from "@/lib/staff-contacts";

export type StaffStudentListItem = { id: string; name: string; school: string | null; grade: string | null; studentPhone: string | null; parentName: string; parentPhone: string | null; classNames: string[] };
export type StaffBillingListItem = { id: string; studentName: string; title: string; amount: number; status: string; dueDate: Date; paidDate: Date | null; invoiceNo: string | null };
type StudentRow = Omit<StaffStudentListItem, "classNames"> & { classNames: string[] | null };

/** 담당 수업을 먼저 확정한 뒤 그 수업의 활성 수강생만 조회합니다. */
export async function getStaffStudents(): Promise<StaffStudentListItem[]> {
  const access = await getStaffClassAccessContext();
  const classIds = await getAccessibleClassIds(access);
  if (!classIds.length) return [];
  const rows = await prisma.$queryRawUnsafe<StudentRow[]>(
    `SELECT s.id, s.name, s.school, s.grade, s.phone AS "studentPhone",
            p.name AS "parentName", p.phone AS "parentPhone",
            array_agg(DISTINCT c.name ORDER BY c.name) AS "classNames"
     FROM "Student" s JOIN "User" p ON p.id = s."parentId"
     JOIN "Enrollment" e ON e."studentId" = s.id AND e.status = 'ACTIVE'
     JOIN "Class" c ON c.id = e."classId"
     WHERE e."classId" = ANY($1::text[])
     GROUP BY s.id, s.name, s.school, s.grade, s.phone, p.name, p.phone ORDER BY s.name`, classIds);
  return rows.map((row) => ({ ...row, studentPhone: normalizePhoneNumber(row.studentPhone), parentPhone: normalizePhoneNumber(row.parentPhone), classNames: row.classNames ?? [] }));
}

/** 교사용 청구 화면은 담당 학생 범위의 조회만 제공하고 상태를 직접 바꾸지 않습니다. */
export async function getStaffBilling(): Promise<StaffBillingListItem[]> {
  const access = await getStaffClassAccessContext();
  const classIds = await getAccessibleClassIds(access);
  if (!classIds.length) return [];

  // 현재 Payment와 PaymentInvoice에는 classId/enrollmentId가 없습니다.
  // 학생의 Enrollment로 우회 연결하면 다른 수업료·셔틀·유니폼 청구까지 노출될 수 있어
  // 수업 귀속 컬럼이 추가되기 전에는 안전하게 아무 청구도 반환하지 않습니다.
  return [];
}
