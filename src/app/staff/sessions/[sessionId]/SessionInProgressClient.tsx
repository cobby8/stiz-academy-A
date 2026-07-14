"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  completeClassSession,
  saveSessionMemo,
  saveStaffAttendance,
} from "@/app/actions/staff-sessions";
import { SessionPhotoUploader } from "@/components/staff/SessionPhotoUploader";
import { VoiceToTextButton } from "@/components/staff/VoiceToTextButton";
import type {
  StaffSessionDetail,
  StaffSessionStudent,
} from "@/lib/staff-session-queries";

type View = "main" | "attendance";
type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT";

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "출석",
  LATE: "지각",
  ABSENT: "결석",
};

function formatElapsed(seconds: number) {
  const hours = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${rest}`;
}

export default function SessionInProgressClient({
  session,
  initialStudents,
  initialView,
}: {
  session: StaffSessionDetail;
  initialStudents: StaffSessionStudent[];
  initialView: View;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  const [students, setStudents] = useState(initialStudents);
  const [elapsed, setElapsed] = useState(0);
  const [memo, setMemo] = useState(session.notes || "");
  const [message, setMessage] = useState("");
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!session.startedAt) return;
    const update = () => {
      const startedAt = new Date(session.startedAt!).getTime();
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    };
    update();
    const timer = window.setInterval(update, 1000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [session.startedAt]);

  const counts = useMemo(
    () => ({
      PRESENT: students.filter((student) => student.status === "PRESENT").length,
      LATE: students.filter((student) => student.status === "LATE").length,
      ABSENT: students.filter((student) => student.status === "ABSENT").length,
      UNCHECKED: students.filter((student) => !student.status).length,
    }),
    [students],
  );

  function updateAttendance(studentId: string, status: AttendanceStatus) {
    setMessage("");
    startTransition(async () => {
      const result = await saveStaffAttendance({
        sessionId: session.id,
        studentId,
        status,
      });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setStudents((current) =>
        current.map((student) =>
          student.id === studentId
            ? {
                ...student,
                status,
                arrivedAt:
                  status === "LATE" ? student.arrivedAt || new Date().toISOString() : null,
              }
            : student,
        ),
      );
    });
  }

  function markAllPresent() {
    const unchecked = students.filter((student) => !student.status);
    startTransition(async () => {
      for (const student of unchecked) {
        const result = await saveStaffAttendance({
          sessionId: session.id,
          studentId: student.id,
          status: "PRESENT",
        });
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
      }
      setStudents((current) =>
        current.map((student) =>
          student.status ? student : { ...student, status: "PRESENT" },
        ),
      );
    });
  }

  function saveMemo() {
    startTransition(async () => {
      const result = await saveSessionMemo({ sessionId: session.id, notes: memo });
      setMessage(result.ok ? "특이사항을 저장했습니다." : result.message);
    });
  }

  function finishSession() {
    startTransition(async () => {
      const result = await completeClassSession({ sessionId: session.id });
      if (!result.ok) {
        setMessage(result.message);
        setShowEndConfirm(false);
        return;
      }
      router.push("/staff");
      router.refresh();
    });
  }

  if (view === "attendance") {
    return (
      <main className="mx-auto max-w-lg space-y-4 px-4 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[var(--brand-accent)]">{session.className}</p>
            <h1 className="text-2xl font-black text-brand-navy-900 dark:text-white">출석 확인</h1>
          </div>
          <button
            type="button"
            onClick={() => setView("main")}
            className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-black dark:border-gray-700 dark:bg-gray-900"
          >
            수업으로 돌아가기
          </button>
        </div>

        <section className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
          <div className="rounded-xl bg-green-50 p-3 text-green-700">출석 {counts.PRESENT}</div>
          <div className="rounded-xl bg-amber-50 p-3 text-amber-700">지각 {counts.LATE}</div>
          <div className="rounded-xl bg-red-50 p-3 text-red-700">결석 {counts.ABSENT}</div>
          <div className="rounded-xl bg-gray-100 p-3 text-gray-600">미확인 {counts.UNCHECKED}</div>
        </section>

        <button
          type="button"
          disabled={pending || counts.UNCHECKED === 0}
          onClick={markAllPresent}
          className="min-h-12 w-full rounded-xl bg-[var(--brand-accent)] font-black text-[var(--brand-accent-contrast)] disabled:opacity-50"
        >
          미확인 학생 전체 출석
        </button>

        <section className="space-y-3">
          {students.map((student) => (
            <article key={student.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <strong className="text-base dark:text-white">{student.name}</strong>
                <span className="text-xs font-bold text-gray-500">
                  {student.status ? STATUS_LABEL[student.status] : "미확인"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(["PRESENT", "LATE", "ABSENT"] as AttendanceStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={pending}
                    onClick={() => updateAttendance(student.id, status)}
                    className={`min-h-11 rounded-xl border text-sm font-black ${
                      student.status === status
                        ? "border-[var(--brand-accent)] bg-[var(--brand-accent)] text-[var(--brand-accent-contrast)]"
                        : "border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    }`}
                  >
                    {STATUS_LABEL[status]}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </section>
        {message && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p>}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-5">
      <section className="rounded-2xl bg-brand-navy-900 p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[var(--brand-accent)]">{session.startTime}~{session.endTime}</p>
            <h1 className="mt-1 text-2xl font-black">{session.className}</h1>
            <p className="mt-1 text-sm text-gray-300">{session.location || "장소 미지정"} · 학생 {session.studentCount}명</p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">수업 중</span>
        </div>
        <div className="mt-5 text-center">
          <p className="text-xs font-bold text-gray-300">수업 경과 시간</p>
          <p className="mt-1 font-mono text-4xl font-black tabular-nums">{formatElapsed(elapsed)}</p>
        </div>
      </section>

      <button
        type="button"
        onClick={() => setView("attendance")}
        className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 font-black dark:border-gray-800 dark:bg-gray-900"
      >
        <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[var(--brand-accent)]">fact_check</span>출석부로 돌아가기</span>
        <span className="text-sm text-gray-500">미확인 {counts.UNCHECKED}</span>
      </button>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="flex items-center gap-2 font-black"><span className="material-symbols-outlined text-[var(--brand-accent)]">description</span>미리 등록한 수업 내용</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-600 dark:text-gray-300">{session.plannedContent || "미리 등록된 수업 내용이 없습니다."}</p>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 flex items-center gap-2 font-black"><span className="material-symbols-outlined text-[var(--brand-accent)]">photo_camera</span>수업 사진</h2>
        <SessionPhotoUploader sessionId={session.id} />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="flex items-center gap-2 font-black"><span className="material-symbols-outlined text-[var(--brand-accent)]">mic</span>수업 중 특이사항</h2>
        <textarea
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          rows={5}
          placeholder="직접 입력하거나 음성으로 기록하세요."
          className="mt-3 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm leading-6 outline-none focus:border-[var(--brand-accent)] dark:border-gray-700 dark:bg-gray-800"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <VoiceToTextButton onText={(text) => setMemo((current) => current ? `${current}\n${text}` : text)} />
          <button type="button" disabled={pending} onClick={saveMemo} className="min-h-11 rounded-xl bg-brand-navy-900 px-4 text-sm font-black text-white disabled:opacity-50">메모 저장</button>
        </div>
      </section>

      {message && <p aria-live="polite" className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700">{message}</p>}

      <button type="button" onClick={() => setShowEndConfirm(true)} className="min-h-14 w-full rounded-2xl bg-red-600 px-4 font-black text-white"><span className="material-symbols-outlined mr-2 align-middle">stop_circle</span>수업 종료</button>

      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-4 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-labelledby="end-session-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <h2 id="end-session-title" className="text-xl font-black dark:text-white">수업을 종료하시겠습니까?</h2>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs font-bold">
              <div className="rounded-lg bg-green-50 p-2 text-green-700">출석 {counts.PRESENT}</div>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-700">지각 {counts.LATE}</div>
              <div className="rounded-lg bg-red-50 p-2 text-red-700">결석 {counts.ABSENT}</div>
              <div className="rounded-lg bg-gray-100 p-2 text-gray-600">미확인 {counts.UNCHECKED}</div>
            </div>
            {counts.UNCHECKED > 0 && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">출결이 확인되지 않은 학생이 있습니다. 출석부를 먼저 확인해 주세요.</p>}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" disabled={pending} onClick={() => setShowEndConfirm(false)} className="min-h-12 rounded-xl border border-gray-200 font-bold dark:border-gray-700">돌아가기</button>
              <button type="button" disabled={pending || counts.UNCHECKED > 0} onClick={finishSession} className="min-h-12 rounded-xl bg-red-600 font-black text-white disabled:opacity-50">종료 확인</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
