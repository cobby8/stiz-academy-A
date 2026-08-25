"use client";

import { useState, useTransition } from "react";
import {
  applyOperationsWebsite,
  approveOperationsRequest,
  applyOperationsSheet,
  createOperationsRequest,
  recordOperationsExternalCheck,
} from "@/app/actions/operations-sync";

type SyncAttempt = { target: "SHEET" | "RALLYZ" | "WEBSITE"; status: string };
type Command = {
  id: string;
  studentName: string | null;
  kind: string;
  effectiveMonth: string;
  confidence: string;
  status: string;
  holdReason: string | null;
  beforeJson: { enrollments?: Array<{ id: string; status: string; className: string }> } | null;
  afterJson: { enrollments?: Array<{ id: string; status: string; className: string }> } | null;
  targets: SyncAttempt[];
};
type RequestRow = { id: string; sourceText: string; targetMonth: string; status: string; createdAt: string; commands: Command[] };

const KIND_LABEL: Record<string, string> = {
  PAUSE: "휴원", WITHDRAW: "퇴원", RESUME: "복귀", CLASS_CHANGE: "반 변경", CLASS_ADD: "추가 수강",
  SHUTTLE_START: "셔틀 탑승", SHUTTLE_STOP: "셔틀 중단", SHUTTLE_EXEMPT: "셔틀비 면제",
  SHUTTLE_CHANGE: "셔틀 변경", CONTACT_UPDATE: "연락처 변경", BILLING_CORRECTION: "청구 수정", UNKNOWN: "확인 필요",
};
const TARGET_LABEL = { SHEET: "시트", RALLYZ: "랠리즈", WEBSITE: "홈페이지" } as const;

export default function OperationsSyncClient({ initialRequests }: { initialRequests: RequestRow[] }) {
  const [sourceText, setSourceText] = useState("");
  const [targetMonth, setTargetMonth] = useState(new Date().toISOString().slice(0, 7));
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      try {
        const result = await createOperationsRequest(sourceText, targetMonth);
        setMessage(`${result.commandCount}개의 변경 명령을 만들었습니다. 외부 시스템에는 아직 반영하지 않았습니다.`);
        setSourceText("");
        window.location.reload();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "요청을 저장하지 못했습니다.");
      }
    });
  }

  function runRequestAction(action: () => Promise<{ ok: true } | { ok: true; ready: number } | { ok: true; applied: number }>, success: string) {
    startTransition(async () => {
      try {
        await action();
        setMessage(success);
        window.location.reload();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "작업을 완료하지 못했습니다.");
      }
    });
  }

  function confirmRallyz(command: Command) {
    const targetStatus = command.kind === "PAUSE" ? "휴원중" : command.kind === "WITHDRAW" ? "퇴원" : "요청 상태";
    const classes = command.beforeJson?.enrollments?.map((row) => row.className).join(", ") || "수강반 미확인";
    if (!window.confirm(`${command.studentName || "해당 학생"}을 랠리즈에서 검색해 전화·생년월일과 수강반(${classes})을 대조하고 상태를 '${targetStatus}'으로 변경한 뒤, 목록을 다시 열어 결과까지 확인했습니까?`)) return;
    runRequestAction(
      () => recordOperationsExternalCheck(command.id, "RALLYZ", true),
      "랠리즈 반영과 재확인 결과를 기록했습니다.",
    );
  }

  function applySheet(commandId: string, studentName: string | null) {
    if (!window.confirm(`${studentName || "해당 학생"}의 이름·적용 월·생년월일/전화가 일치하는 구글 시트 행을 휴원/퇴원으로 실제 변경합니다. 실행할까요?`)) return;
    runRequestAction(() => applyOperationsSheet(commandId), "구글 시트를 변경하고 저장 결과를 재확인했습니다.");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-black text-gray-950 dark:text-white">3중 동기화 입력함</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">학부모 요청을 붙여넣고 시트·랠리즈·홈페이지의 반영 계획을 함께 관리합니다.</p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="grid gap-4 md:grid-cols-[180px_1fr]">
          <label className="text-sm font-bold text-gray-700 dark:text-gray-200">적용 월
            <input type="month" value={targetMonth} onChange={(event) => setTargetMonth(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-950" />
          </label>
          <label className="text-sm font-bold text-gray-700 dark:text-gray-200">학부모 요청
            <textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows={5} placeholder="예: 김민서 9월 휴원, 서정빈 셔틀 탑승" className="mt-2 w-full resize-y rounded-xl border border-gray-300 bg-white px-3 py-3 dark:border-gray-600 dark:bg-gray-950" />
          </label>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p role="status" className="text-sm font-bold text-amber-700 dark:text-amber-300">{message || "저장하면 미리보기 명령만 생성되며 자동 반영되지 않습니다."}</p>
          <button type="button" disabled={isPending || !sourceText.trim()} onClick={submit} className="min-h-11 rounded-xl bg-[var(--brand-accent)] px-5 font-black text-[var(--brand-accent-contrast)] disabled:opacity-50">{isPending ? "분석 중…" : "변경 계획 만들기"}</button>
        </div>
      </section>

      <section className="space-y-4">
        {initialRequests.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-500">아직 저장된 동기화 요청이 없습니다.</div> : initialRequests.map((request) => (
          <article key={request.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-black text-gray-950 dark:text-white">{request.targetMonth} 요청</p><p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{request.sourceText}</p></div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-700 dark:bg-gray-800 dark:text-gray-200">{request.status}</span>
                {(request.status === "DRAFT" || request.status === "HELD") && <button type="button" disabled={isPending} onClick={() => runRequestAction(() => approveOperationsRequest(request.id), "변경 전·후 미리보기를 확정했습니다.")} className="min-h-10 rounded-xl border border-gray-300 px-3 text-xs font-black dark:border-gray-600">미리보기 승인</button>}
                {(["APPROVED", "PENDING", "PARTIAL"].includes(request.status)) && <button type="button" disabled={isPending} onClick={() => { if (window.confirm("시트와 랠리즈 확인 결과대로 홈페이지 수강 상태를 최종 변경할까요?")) runRequestAction(() => applyOperationsWebsite(request.id), "홈페이지 최종 반영과 3중 상태 검증을 완료했습니다."); }} className="min-h-10 rounded-xl bg-[var(--brand-accent)] px-3 text-xs font-black text-[var(--brand-accent-contrast)]">홈페이지 최종 반영</button>}
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead><tr className="border-b border-gray-200 text-xs text-gray-500 dark:border-gray-700"><th className="p-2">학생</th><th className="p-2">변경</th><th className="p-2">적용 월</th><th className="p-2">시트</th><th className="p-2">랠리즈</th><th className="p-2">홈페이지</th><th className="p-2">판정</th></tr></thead>
                <tbody>{request.commands.map((command) => <tr key={command.id} className="border-b border-gray-100 align-top last:border-0 dark:border-gray-800"><td className="p-2 font-black">{command.studentName || "미확인"}{command.beforeJson?.enrollments?.length ? <p className="mt-1 text-xs font-medium text-gray-500">{command.beforeJson.enrollments.map((row) => `${row.className} ${row.status}`).join(" · ")} → {command.afterJson?.enrollments?.[0]?.status}</p> : null}</td><td className="p-2">{KIND_LABEL[command.kind] || command.kind}</td><td className="p-2">{command.effectiveMonth}</td>{(["SHEET", "RALLYZ", "WEBSITE"] as const).map((target) => { const status = command.targets?.find((item) => item.target === target)?.status || "PENDING"; const sheetDone = command.targets?.find((item) => item.target === "SHEET")?.status === "SUCCEEDED"; const canConfirm = ["APPROVED", "PENDING", "PARTIAL"].includes(request.status) && target !== "WEBSITE" && status !== "SUCCEEDED" && command.status !== "HELD" && (target === "SHEET" || sheetDone); return <td key={target} className="p-2"><span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">{TARGET_LABEL[target]} · {status}</span>{canConfirm ? <button type="button" disabled={isPending} onClick={() => target === "SHEET" ? applySheet(command.id, command.studentName) : confirmRallyz(command)} className="mt-2 block min-h-9 rounded-lg border border-gray-300 px-2 text-xs font-black dark:border-gray-600">{target === "SHEET" ? "시트 자동 반영" : "랠리즈 처리 후 확인"}</button> : null}</td>; })}<td className="p-2">{command.holdReason ? <span className="font-bold text-red-600">확인보류: {command.holdReason}</span> : command.status === "SYNCED" ? <span className="font-bold text-emerald-600">3곳 일치</span> : <span className="font-bold text-blue-600">반영 대기</span>}</td></tr>)}</tbody>
              </table>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
