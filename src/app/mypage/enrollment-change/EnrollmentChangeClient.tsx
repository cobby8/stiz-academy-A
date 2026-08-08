"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CHANGE_KIND_LABEL,
  CHANGE_STATUS_LABEL,
  type ChangeKind,
} from "@/lib/enrollment/changeRequestRules";
import type { EnrollmentChangeOptions } from "@/lib/enrollment/parent-change-request";

const DAY_KO: Record<string, string> = {
  Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};

const KIND_HELP: Record<ChangeKind, string> = {
  CLASS_CHANGE: "다른 요일·시간의 반으로 옮깁니다.",
  PAUSE: "잠시 쉬었다가 다시 나옵니다. 자리는 비워둡니다.",
  WITHDRAW: "그만둡니다. 자리가 다른 학생에게 넘어갑니다.",
};

export default function EnrollmentChangeClient({ initial }: { initial: EnrollmentChangeOptions }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [childIdx, setChildIdx] = useState(0);
  const [kind, setKind] = useState<ChangeKind>("CLASS_CHANGE");
  const [toClassId, setToClassId] = useState("");
  const [resumeOn, setResumeOn] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const child = initial.children[childIdx];
  // 지금 다니는 반은 고를 수 없다. 골라봐야 아무것도 바뀌지 않는다.
  const selectable = useMemo(
    () => initial.classes.filter((item) => item.classId !== child?.currentClassId),
    [initial.classes, child?.currentClassId],
  );

  async function send(body: Record<string, unknown>) {
    setError("");
    setDone("");
    const response = await fetch("/api/mypage/enrollment-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data?.error || "처리에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      return false;
    }
    return true;
  }

  function submit() {
    if (!child) return;
    startTransition(async () => {
      const ok = await send({
        enrollmentId: child.enrollmentId,
        kind,
        toClassId: kind === "CLASS_CHANGE" ? toClassId : undefined,
        resumeOn: kind === "PAUSE" ? resumeOn || undefined : undefined,
        reason,
      });
      if (!ok) return;
      setDone("신청이 접수되었습니다. 학원에서 확인 후 알려드립니다.");
      setToClassId("");
      setResumeOn("");
      setReason("");
      router.refresh();
    });
  }

  function cancel(id: string) {
    startTransition(async () => {
      if (!(await send({ action: "cancel", id }))) return;
      setDone("신청을 취소했습니다.");
      router.refresh();
    });
  }

  if (initial.children.length === 0) {
    return (
      <main className="mx-auto max-w-lg px-4 py-6">
        <h1 className="text-xl font-black text-brand-navy-900 dark:text-white">수강 변경 신청</h1>
        <p className="mt-3 rounded-2xl bg-white p-5 text-sm text-gray-500 shadow-sm dark:bg-gray-800 dark:text-gray-300">
          지금 다니고 있는 반이 없습니다. 학원으로 문의해 주세요.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-black text-brand-navy-900 dark:text-white">수강 변경 신청</h1>
        {/* 적용일을 먼저 알린다. 언제부터 바뀌는지 모르고 신청하면 그게 곧 문의가 된다. */}
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          신청하신 내용은 <b className="text-brand-navy-900 dark:text-white">{initial.effectiveFrom}</b>부터 적용됩니다.
        </p>
      </div>

      {initial.children.length > 1 && (
        <select
          value={childIdx}
          onChange={(event) => setChildIdx(Number(event.target.value))}
          className="min-h-11 w-full rounded-xl border border-gray-200 px-3 dark:border-gray-700 dark:bg-gray-800"
        >
          {initial.children.map((item, index) => (
            <option key={item.enrollmentId} value={index}>
              {item.studentName} · {item.currentClassName}
            </option>
          ))}
        </select>
      )}

      {child?.pending ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-sm font-black text-amber-900 dark:text-amber-200">
            {CHANGE_STATUS_LABEL.PENDING}인 신청이 있습니다
          </p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            {CHANGE_KIND_LABEL[child.pending.kind as ChangeKind] ?? child.pending.kind}
            {child.pending.toClassName ? ` · ${child.pending.toClassName}` : ""} · {child.pending.effectiveFrom}부터
            {child.pending.waitlisted ? " · 자리가 나면 배정됩니다" : ""}
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => cancel(child.pending!.id)}
            className="mt-3 min-h-11 w-full rounded-xl border border-amber-300 bg-white px-4 text-sm font-bold text-amber-900 disabled:opacity-50 dark:border-amber-800 dark:bg-gray-900 dark:text-amber-200"
          >
            신청 취소하기
          </button>
        </section>
      ) : (
        <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400">지금 다니는 반</p>
            <p className="font-black text-brand-navy-900 dark:text-white">
              {child.currentClassName} <span className="text-sm font-bold text-gray-500">· {child.currentProgramName}</span>
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(CHANGE_KIND_LABEL) as ChangeKind[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                className={`min-h-11 rounded-xl border text-sm font-bold ${
                  kind === value
                    ? "border-[var(--brand-accent)] bg-[var(--brand-accent)] text-[var(--brand-accent-contrast)]"
                    : "border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                }`}
              >
                {CHANGE_KIND_LABEL[value]}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{KIND_HELP[kind]}</p>

          {kind === "CLASS_CHANGE" && (
            <div>
              <label htmlFor="to-class" className="mb-1 block text-xs font-bold text-gray-500 dark:text-gray-400">
                옮기고 싶은 반
              </label>
              <select
                id="to-class"
                value={toClassId}
                onChange={(event) => setToClassId(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-gray-200 px-3 dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="">반을 선택해 주세요</option>
                {selectable.map((item) => (
                  <option key={item.classId} value={item.classId}>
                    {DAY_KO[item.dayOfWeek] ?? item.dayOfWeek} {item.startTime}~{item.endTime} · {item.programName}
                    {item.full ? " (정원 마감 · 대기)" : ` (${item.capacity - item.enrolled}자리)`}
                  </option>
                ))}
              </select>
              {/* 만석이어도 신청은 받는다(원장 결정). 대신 기대를 정확히 만든다. */}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                정원이 찬 반도 신청할 수 있어요. 자리가 나면 순서대로 배정됩니다.
              </p>
            </div>
          )}

          {kind === "PAUSE" && (
            <div>
              <label htmlFor="resume-on" className="mb-1 block text-xs font-bold text-gray-500 dark:text-gray-400">
                복귀 예정일 (선택)
              </label>
              <input
                id="resume-on"
                type="date"
                value={resumeOn}
                onChange={(event) => setResumeOn(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-gray-200 px-3 dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
          )}

          <div>
            <label htmlFor="change-reason" className="mb-1 block text-xs font-bold text-gray-500 dark:text-gray-400">
              사유 (선택)
            </label>
            <textarea
              id="change-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="학원에서 참고할 내용을 적어주세요"
              className="w-full rounded-xl border border-gray-200 p-3 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>

          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

          <button
            type="button"
            disabled={pending || (kind === "CLASS_CHANGE" && !toClassId)}
            onClick={submit}
            className="min-h-12 w-full rounded-xl bg-[var(--brand-accent)] font-black text-[var(--brand-accent-contrast)] disabled:opacity-50"
          >
            {pending ? "접수 중..." : "신청하기"}
          </button>
        </section>
      )}

      {done && <p className="rounded-xl bg-green-50 p-3 text-sm font-bold text-green-800">{done}</p>}

      <p className="text-center text-xs text-gray-400">
        요금이 달라지는 반으로 옮기면 학원에서 다시 안내드립니다.
      </p>
    </main>
  );
}
