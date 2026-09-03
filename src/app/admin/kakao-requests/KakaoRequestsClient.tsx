"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideKakaoParentIntake, type KakaoIntakeDecision } from "@/app/actions/kakao-parent-intake-admin";

export type KakaoRequestAdminRow = {
  id: string; kind: string; sourceText: string; structuredJson: Record<string, unknown> | null; status: string;
  studentId: string | null; studentName: string | null; studentGrade: string | null; parentName: string | null;
  identityStatus: string; operationsRequestId: string | null; decisionNote: string | null; decidedByName: string | null;
  createdAt: string; decidedAt: string | null;
};

const FILTERS = [["ACTION","처리 필요"],["SUBMITTED","신규"],["HELD","보류"],["FAILED","실패"],["DONE","처리 완료"],["ALL","전체"]] as const;
const LABEL: Record<string,string> = { SUBMITTED:"신규 접수", HELD:"관리자 확인 필요", FAILED:"처리 실패", NEEDS_DETAILS:"추가 확인 필요", APPROVED:"운영 원장 이관", REJECTED:"접수 반려", CONSULTATION:"상담 전환", APPLIED:"자동 반영 완료", CANCELED:"학부모 취소" };
const TRANSFERABLE = new Set(["PAUSE","WITHDRAW","RESUME","CLASS_CHANGE","CLASS_ADD","SHUTTLE_START_STOP","SHUTTLE_CHANGE","SHUTTLE_FEE","CONTACT_CHANGE","BILLING_CORRECTION"]);
const REVIEWABLE = new Set(["SUBMITTED","HELD","FAILED","NEEDS_DETAILS"]);
const formatDate = (value: string) => new Intl.DateTimeFormat("ko-KR", { timeZone:"Asia/Seoul", dateStyle:"short", timeStyle:"short" }).format(new Date(value));

export default function KakaoRequestsClient({ rows, status, schemaReady }: { rows: KakaoRequestAdminRow[]; status: string; schemaReady: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [error, setError] = useState("");
  function decide(id: string, decision: KakaoIntakeDecision) {
    setError("");
    startTransition(async () => {
      try {
        const result = await decideKakaoParentIntake({ intakeId:id, decision, note:notes[id] });
        if (!result.ok) return setError(result.message);
        router.refresh();
      } catch (caught) { setError(caught instanceof Error ? caught.message : "처리 중 오류가 발생했습니다."); }
    });
  }
  return <main className="mx-auto max-w-4xl space-y-5 p-4">
    <header><p className="text-sm font-bold text-yellow-600">학부모 채널</p><h1 className="mt-1 text-2xl font-black dark:text-white">카카오 접수함</h1><p className="mt-2 text-sm text-gray-500">운영 원장 이관은 검토용 HELD 명령만 만들며 시트·랠리즈 변경이나 메시지 발송을 실행하지 않습니다.</p></header>
    {!schemaReady && <section role="alert" className="rounded-2xl bg-amber-50 p-5 text-amber-950"><b>관리자 검토용 DB 적용이 필요합니다.</b><p className="mt-2 text-sm">새 migration 적용 전에는 목록과 처리 기능을 열지 않습니다.</p></section>}
    <nav className="flex gap-2 overflow-x-auto" aria-label="접수 상태 필터">{FILTERS.map(([value,label]) => <button key={value} type="button" onClick={() => router.push(`/admin/kakao-requests?status=${value}`)} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold ${status===value ? "bg-brand-navy-900 text-white" : "border bg-white text-gray-600"}`}>{label}</button>)}</nav>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
    {!schemaReady || rows.length===0 ? <p className="rounded-2xl border bg-white p-8 text-center text-sm text-gray-500">{schemaReady ? "해당 요청이 없습니다." : "DB 준비 후 표시됩니다."}</p> : <ul className="space-y-4">{rows.map(row => {
      const identityOk = row.identityStatus==="ACTIVE" && Boolean(row.studentId);
      return <li key={row.id} className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-900">
        <div className="flex flex-wrap gap-2"><span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-black text-yellow-800">{LABEL[row.status] ?? row.status}</span><strong>{row.studentName ?? "학생 확인 필요"}</strong><span className="text-xs text-gray-500">{row.studentGrade} · {row.kind}</span><time className="ml-auto text-xs text-gray-400">{formatDate(row.createdAt)}</time></div>
        <p className="mt-3 whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-sm">{row.sourceText}</p>
        <section className="mt-3 rounded-xl border p-3 text-xs"><b>인증·구조화 확인</b><p className={identityOk ? "mt-2 text-green-700" : "mt-2 text-red-700"}>{identityOk ? `최초 인증 완료 · 학생 ID 연결 · 보호자 ${row.parentName ?? "확인"}` : "인증 또는 학생 ID 확인 필요"}</p><pre className="mt-2 overflow-auto whitespace-pre-wrap">{row.structuredJson ? JSON.stringify(row.structuredJson, null, 2) : "세부 정보 없음"}</pre></section>
        <p className="mt-3 rounded-xl bg-blue-50 p-3 text-xs text-blue-900"><b>이관 후:</b> 사이트 운영 원장 HELD 생성 · 외부 변경/알림 없음</p>
        {row.operationsRequestId && <Link href="/admin/operations-sync" className="mt-2 inline-block text-sm font-bold text-blue-700 underline">생성된 운영 원장 확인</Link>}
        {row.decidedAt && <p className="mt-2 text-xs text-gray-400">{row.decidedByName ?? "관리자"} · {formatDate(row.decidedAt)} · {row.decisionNote ?? "메모 없음"}</p>}
        {REVIEWABLE.has(row.status) && <div className="mt-4 space-y-2"><textarea rows={2} maxLength={500} value={notes[row.id] ?? ""} onChange={e => setNotes(v => ({...v,[row.id]:e.target.value}))} placeholder="보류·반려·상담 사유" className="w-full rounded-xl border p-3 text-sm"/><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[["NEEDS_DETAILS","추가 확인"],["CONSULTATION","상담 전환"],["REJECT","접수 반려"]].map(([decision,label]) => <button key={decision} disabled={pending} onClick={() => decide(row.id, decision as KakaoIntakeDecision)} className="min-h-11 rounded-xl border font-bold disabled:opacity-40">{label}</button>)}<button disabled={pending || !identityOk || !TRANSFERABLE.has(row.kind)} onClick={() => decide(row.id,"TRANSFER")} className="min-h-11 rounded-xl bg-[var(--brand-accent)] px-2 font-black text-[var(--brand-accent-contrast)] disabled:opacity-40">운영 원장 이관</button></div></div>}
      </li>;
    })}</ul>}
  </main>;
}
