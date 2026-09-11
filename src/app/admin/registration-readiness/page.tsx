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
    prisma.operationsCommand.findMany({ where: { studentId: { in: studentIds }, kind: { in: ["CLASS_ADD", "RESUME"] } },
      select: { id: true, studentId: true, kind: true, status: true, effectiveMonth: true, createdAt: true, afterJson: true,
        syncAttempts: { select: { target: true, status: true, verifiedAt: true } } } }),
    prisma.paymentInvoice.findMany({ where: { studentId: { in: studentIds }, canceledAt: null, status: { in: ["ISSUED", "SENT", "OVERDUE", "PAID"] }, amount: { gt: 0 } }, select: { studentId: true } }),
  ]);
  return <main className="p-6 space-y-6">
    <h1 className="text-2xl font-bold">입학 완료 확인</h1>
    <p>최근 승인 신청 최대 100건의 읽기 전용 점검입니다. 승인은 등록 절차의 시작이며, 확인 필요는 실패나 미발송 확정이 아닙니다. 기존·복귀 신청도 포함될 수 있습니다.</p>
    <p>외부 원장의 출처와 재조회 기록을 연결해 보여줍니다. 확정 수강 시작일 근거가 없어 외부 등록은 계속 확인 필요입니다. 승인 처리일은 실제 시작일이 아닙니다. 이 화면에서는 발송·청구·장부 변경을 하지 않습니다.</p>
    <Link className="underline" href="/admin/apply">신청 관리로 이동</Link>
    {applications.length === 0 && <p>승인된 신청이 없습니다.</p>}
    {applications.map((app) => {
      const result = registrationReadiness({ applicationId: app.id, studentId: app.convertedStudentId,
        assignedClassIds: [...new Set((app.assignedClassId ?? "").split(",").map((id) => id.trim()).filter(Boolean))],
        activeClassIds: enrollments.filter((row) => row.studentId === app.convertedStudentId).map((row) => row.classId),
        shuttleNeeded: app.shuttleNeeded, commands: commands.filter((row) => row.studentId === app.convertedStudentId),
        invoiceCandidates: invoices.filter((row) => row.studentId === app.convertedStudentId).length });
      return <section key={app.id} className="border rounded-xl p-4 space-y-3">
        <h2 className="font-bold">{app.childName} · 등록 절차 확인 필요</h2>
        <p className="text-sm break-all">신청 ID: {app.id} / 학생 ID: {app.convertedStudentId ?? "미연결"}</p>
        <ul className="space-y-2">{result.checks.map((check) => <li key={check.key}>
          <strong>{check.label}: {check.status === "VERIFIED" ? check.key === "site" ? "현재 수강 확인" : "등록 재조회 확인" : "확인 필요"}</strong><p className="text-sm">{check.detail}</p>
        </li>)}</ul>
        <details className="space-y-3">
          <summary className="cursor-pointer font-bold">등록 원장 증거 {result.evidence.length}건 보기</summary>
          <p className="text-sm">아래 날짜·월은 원장 기록값이며 확정 수강 시작일을 뜻하지 않습니다. 이후 변경·무효화 여부도 별도 대조해야 합니다.</p>
          {result.evidence.length === 0 && <p>연결 후보 없음 · 기존 수강 유지나 복귀 신청은 신규 등록 원장이 없을 수 있습니다.</p>}
          {result.evidence.map((item, index) => <article key={`${item.commandId ?? "missing"}-${index}`} className="space-y-2 rounded border p-3 text-sm break-all">
            <p>명령 ID: {item.commandId ?? "없음"} · 상태: {item.status}</p>
            <p>원장 신청 ID: {item.applicationId ?? "없음"} · 학생 ID: {item.studentId ?? "없음"}</p>
            <p>반 ID: {item.classId ?? "없음"} · 수강 ID: {item.enrollmentId ?? "없음"}</p>
            <p>출처: {item.source ?? "미확인"} · 종류: {item.kind ?? "미확인"} · 기록 월: {item.effectiveMonth ?? "없음"} · 기록 날짜: {item.eventDate ?? "없음"}</p>
            <p>명령 생성 시각: {item.createdAt ?? "미확인"}</p>
            <p>확인 필요: {item.reasons.join(" · ")}</p>
            {item.targets.map(target => <div key={target.target}>
              <b>{target.target === "SHEET" ? "시트" : "Rallyz"} 재조회 기록</b>
              {target.duplicate && <p>중복된 타깃 기록 · 대조 필요</p>}
              {target.attempts.length === 0 && <p>재조회 기록 없음</p>}
              {target.attempts.map((attempt, attemptIndex) => <p key={attemptIndex}>{attempt.status} · {attempt.verifiedAt ?? "시각 없음"} · {attempt.issue ?? "재조회 성공 기록 있음 · 등록 완료 판정은 보류"}</p>)}
            </div>)}
          </article>)}
        </details>
      </section>;
    })}
  </main>;
}
