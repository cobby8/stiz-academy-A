import { prisma } from "@/lib/prisma";
import { requireStaffClassAccess } from "@/lib/staff-class-access";

export type StaffClassBillingStatus = "UNPAID" | "PENDING_CONFIRMATION" | "PAID";

export type StaffClassBillingItem = {
  id: string;
  classId: string;
  studentId: string;
  studentName: string;
  title: string;
  amount: number;
  paymentStatus: string;
  invoiceStatus: string;
  dueDate: Date;
  paidDate: Date | null;
  invoiceNo: string;
  confirmationStatus: string | null;
  status: StaffClassBillingStatus;
};

type StaffClassBillingRow = Omit<StaffClassBillingItem, "status">;

/**
 * 수업 현장에서 사용할 청구를 한 번의 쿼리로 조회합니다.
 * 반 담당 권한, 활성 수강, 결제-청구서의 반/학생/금액 일치를 모두 서버에서 확인합니다.
 */
export async function getStaffClassBilling(
  classId: string,
  studentId?: string,
): Promise<StaffClassBillingItem[]> {
  const normalizedClassId = classId.trim();
  const normalizedStudentId = studentId?.trim() || null;
  await requireStaffClassAccess(normalizedClassId);

  const rows = await prisma.$queryRawUnsafe<StaffClassBillingRow[]>(
    `SELECT p.id, p."classId", p."studentId", s.name AS "studentName",
            COALESCE(NULLIF(i.title, ''), NULLIF(p.description, ''), '수강료') AS title,
            p.amount, p.status AS "paymentStatus", i.status AS "invoiceStatus",
            p."dueDate", p."paidDate", i."invoiceNo",
            confirmation.status AS "confirmationStatus"
       FROM "Payment" p
       JOIN "PaymentInvoice" i
         ON i."paymentId" = p.id
        AND i."classId" = p."classId"
        AND i."studentId" = p."studentId"
        AND i.amount = p.amount
       JOIN "Student" s ON s.id = p."studentId"
       JOIN "Enrollment" e
         ON e."studentId" = p."studentId"
        AND e."classId" = p."classId"
        AND e.status = 'ACTIVE'
       LEFT JOIN LATERAL (
         SELECT request.status
           FROM "StaffPaymentConfirmationRequest" request
          WHERE request."paymentId" = p.id
          ORDER BY request."createdAt" DESC
          LIMIT 1
       ) confirmation ON true
      WHERE p."classId" = $1
        AND ($2::text IS NULL OR p."studentId" = $2)
        AND p.status IN ('PENDING', 'OVERDUE', 'PAID')
        AND i.status <> 'CANCELED'
      ORDER BY CASE
        WHEN confirmation.status = 'PENDING' THEN 0
        WHEN p.status IN ('PENDING', 'OVERDUE') THEN 1
        ELSE 2
      END, p."dueDate" DESC, s.name`,
    normalizedClassId,
    normalizedStudentId,
  );

  return rows.map((row) => ({
    ...row,
    status:
      row.confirmationStatus === "PENDING"
        ? "PENDING_CONFIRMATION"
        : row.paymentStatus === "PAID" || row.invoiceStatus === "PAID"
          ? "PAID"
          : "UNPAID",
  }));
}
