import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { registrationReadiness } from "@/lib/enrollment/registration-readiness";

export const dynamic = "force-dynamic";

export default async function RegistrationReadinessPage() {
  await requireAdmin();
  const applications = await prisma.enrollmentApplication.findMany({
    where: { status: "APPROVED" }, orderBy: { processedAt: "desc" }, take: 100,
    select: { id: true, childName: true, convertedStudentId: true, assignedClassId: true, shuttleNeeded: true },
  });
  const studentIds = [...new Set(applications.flatMap((app) => app.convertedStudentId ? [app.convertedStudentId] : []))];
  const [enrollments, commands, invoices] = await Promise.all([
    prisma.enrollment.findMany({ where: { studentId: { in: studentIds }, status: "ACTIVE" }, select: { studentId: true, classId: true } }),
    prisma.operationsCommand.findMany({ where: { studentId: { in: studentIds }, kind: "CLASS_ADD" }, select: { studentId: true, status: true, syncAttempts: { select: { target: true, status: true, verifiedAt: true } } } }),
    prisma.paymentInvoice.findMany({ where: { studentId: { in: studentIds }, canceledAt: null, status: { in: ["ISSUED", "SENT", "OVERDUE", "PAID"] }, amount: { gt: 0 } }, select: { studentId: true } }),
  ]);
  return <main className="p-6 space-y-6">
    <h1 className="text-2xl font-bold">입학 완료 확인</h1>
    <p>최근 승인 신청 최대 100건의 읽기 전용 점검입니다. 승인은 등록 절차의 시작이며, 확인 필요는 실패나 미발송 확정이 아닙니다. 기존·복귀 신청도 포함될 수 있습니다.</p>
    <p>외부 기록은 해당 신청과 직접 연결된 증거가 없어 자동 완료로 표시하지 않습니다. 이 화면에서는 발송·청구·장부 변경을 하지 않습니다.</p>
    <Link className="underline" href="/admin/apply">신청 관리로 이동</Link>
    {applications.length === 0 && <p>승인된 신청이 없습니다.</p>}
    {applications.map((app) => {
      const result = registrationReadiness({ studentId: app.convertedStudentId,
        assignedClassIds: [...new Set((app.assignedClassId ?? "").split(",").map((id) => id.trim()).filter(Boolean))],
        activeClassIds: enrollments.filter((row) => row.studentId === app.convertedStudentId).map((row) => row.classId),
        shuttleNeeded: app.shuttleNeeded, commands: commands.filter((row) => row.studentId === app.convertedStudentId),
        invoiceCandidates: invoices.filter((row) => row.studentId === app.convertedStudentId).length });
      return <section key={app.id} className="border rounded-xl p-4 space-y-3">
        <h2 className="font-bold">{app.childName} · 등록 절차 확인 필요</h2>
        <p className="text-sm break-all">신청 ID: {app.id} / 학생 ID: {app.convertedStudentId ?? "미연결"}</p>
        <ul className="space-y-2">{result.checks.map((check) => <li key={check.key}>
          <strong>{check.label}: {check.status === "VERIFIED" ? "사이트 확인" : "확인 필요"}</strong><p className="text-sm">{check.detail}</p>
        </li>)}</ul>
      </section>;
    })}
  </main>;
}
