import { prisma } from "@/lib/prisma";
import { getAccessibleClassIds, getStaffClassAccessContext } from "@/lib/staff-class-access";
import { resolveStaffBillingGuard } from "@/lib/staff-billing-policy";
import { normalizePhoneNumber } from "@/lib/staff-contacts";

export type StaffStudentListItem = { id: string; name: string; school: string | null; grade: string | null; studentPhone: string | null; parentName: string; parentPhone: string | null; classNames: string[] };
export type StaffBillingListItem = { id: string; classId: string; paymentClassId: string | null; studentName: string; className: string; title: string; amount: number; invoiceAmount: number; amountMismatch: boolean; studentMismatch: boolean; status: string; dueDate: Date; paidDate: Date | null; invoiceNo: string | null; confirmationStatus: string | null; confirmable: boolean; blockReason: string | null };
type StaffBillingRow = Omit<StaffBillingListItem, "confirmable" | "blockReason">;
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

  // 반 연결은 두 갈래입니다. Payment."classId"가 있으면 그 값을 신뢰하고,
  // 비어 있는 과거 청구는 학생의 활성 수강(Enrollment)으로 잇되 정규 월 수강료만 허용합니다.
  // (셔틀·유니폼·특강 청구가 반 정보 없이 새어 나오는 것을 막기 위한 제한입니다.)
  // 한 학생이 여러 반을 들으면 같은 청구가 반마다 잡히므로 DISTINCT ON으로 1건만 남깁니다.
  const rows = await prisma.$queryRawUnsafe<StaffBillingRow[]>(
    `SELECT * FROM (
       SELECT DISTINCT ON (p.id)
              p.id,e."classId",p."classId" AS "paymentClassId",
              s.name AS "studentName",c.name AS "className",
              COALESCE(NULLIF(i.title,''),NULLIF(p.description,''),'수강료') AS title,
              p.amount,i.amount AS "invoiceAmount",
              (i.amount <> p.amount) AS "amountMismatch",
              (i."studentId" <> p."studentId") AS "studentMismatch",
              p.status,p."dueDate",p."paidDate",p."invoiceNo",
              r.status AS "confirmationStatus"
         FROM "Payment" p
         JOIN "PaymentInvoice" i ON i."paymentId"=p.id
         JOIN "Student" s ON s.id=p."studentId"
         JOIN "Enrollment" e ON e."studentId"=p."studentId" AND e.status='ACTIVE' AND e."classId"=ANY($1::text[])
         JOIN "Class" c ON c.id=e."classId"
         LEFT JOIN LATERAL (SELECT status FROM "StaffPaymentConfirmationRequest" r WHERE r."paymentId"=p.id ORDER BY r."createdAt" DESC LIMIT 1) r ON true
        WHERE (p."classId"=e."classId" OR (p."classId" IS NULL AND p.type='MONTHLY'))
          AND p.status IN ('PENDING','OVERDUE','PAID')
          AND i.status <> 'CANCELED'
        ORDER BY p.id,(p."classId" IS NULL),c.name
     ) b
     ORDER BY CASE WHEN b.status IN ('OVERDUE','PENDING') THEN 0 ELSE 1 END,b."dueDate" DESC,b."studentName"`, classIds,
  );

  return rows.map((row) => ({
    ...row,
    ...resolveStaffBillingGuard({
      paymentClassId: row.paymentClassId,
      amountMismatch: row.amountMismatch,
      studentMismatch: row.studentMismatch,
    }),
  }));
}
