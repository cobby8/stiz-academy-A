import { getParentOperationsLinkPreview, submitParentOperationsRequest } from "@/app/actions/parent-operations-request";
import ParentRequestForm from "./ParentRequestForm";

export const dynamic = "force-dynamic";

export default async function ParentOperationsRequestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await getParentOperationsLinkPreview(token);

  async function submitRequest(input: { kind: string; effectiveDate: string; details: string }) {
    "use server";
    const month = input.effectiveDate.slice(0, 7);
    const typeLabel: Record<string, string> = {
      PAUSE: "휴원", WITHDRAW: "퇴원", RESUME: "복귀", CLASS_CHANGE: "반 변경", CLASS_ADD: "추가 수강",
      SHUTTLE_CHANGE: "셔틀 변경", CONTACT_UPDATE: "연락처 변경", BILLING_CORRECTION: "청구 확인", OTHER: "기타 요청",
    };
    await submitParentOperationsRequest(token, `${typeLabel[input.kind] || "기타 요청"} · 희망일 ${input.effectiveDate} · ${input.details}`, month);
    return { ok: true as const };
  }

  const activePreview = preview.status === "ACTIVE" ? preview : null;
  return <ParentRequestForm context={{ valid: preview.status === "ACTIVE", linkStatus: preview.status, studentHint: activePreview?.studentName ? `${activePreview.studentName.slice(0, 1)}○${activePreview.studentName.slice(-1)}` : null, expiresAt: activePreview ? new Date(activePreview.expiresAt).toISOString() : null }} submitRequest={submitRequest} />;
}
