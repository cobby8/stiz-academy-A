"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  savePlannedClassContent,
  startClassSession,
} from "@/app/actions/staff-sessions";
import { createStaffClassNotice } from "@/app/actions/staff-notices";
import { VoiceToTextButton } from "@/components/staff/VoiceToTextButton";
import { useStaffDialog } from "@/components/staff/useStaffDialog";
import type { StaffTodayClass } from "@/lib/staff-session-queries";

function isSeasonalLesson(lesson: StaffTodayClass) {
  return lesson.kind === "SEASONAL";
}

const ClassPeopleSheet = dynamic(
  () => import("@/components/staff/ClassPeopleSheet").then((module) => module.ClassPeopleSheet),
  { ssr: false },
);
const ClassBillingSheet = dynamic(
  () => import("@/components/staff/ClassBillingSheet").then((module) => module.ClassBillingSheet),
  { ssr: false },
);

export default function StaffHomeClient({
  dateKey,
  classes: initialClasses,
}: {
  dateKey: string;
  classes: StaffTodayClass[];
}) {
  const router = useRouter();
  const [classes, setClasses] = useState(initialClasses);
  const [startTarget, setStartTarget] = useState<StaffTodayClass | null>(null);
  const [contentTarget, setContentTarget] = useState<StaffTodayClass | null>(null);
  const [plannedContent, setPlannedContent] = useState("");
  const [noticeTarget, setNoticeTarget] = useState<StaffTodayClass | null>(null);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [peopleTarget, setPeopleTarget] = useState<StaffTodayClass | null>(null);
  const [billingTarget, setBillingTarget] = useState<{ lesson: StaffTodayClass; student?: { id: string; name: string } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const runningClass = classes.find((lesson) => lesson.sessionStatus === "IN_PROGRESS");
  const focusClass = runningClass || classes.find((lesson) => lesson.sessionStatus !== "COMPLETED") || classes[0];
  const otherClasses = classes.filter((lesson) => lesson.scheduleKey !== focusClass?.scheduleKey);
  const completedCount = classes.filter((lesson) => lesson.sessionStatus === "COMPLETED").length;

  function openContent(lesson: StaffTodayClass) {
    setError(null);
    setContentTarget(lesson);
    setPlannedContent(lesson.plannedContent || "");
  }

  function saveContent() {
    if (!contentTarget) return;
    setError(null);
    startTransition(async () => {
      const result = await savePlannedClassContent({ classId: contentTarget.id, date: dateKey, plannedContent });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setClasses((current) => current.map((lesson) => lesson.id === contentTarget.id
        ? { ...lesson, sessionId: result.sessionId, sessionStatus: "PLANNED", plannedContent }
        : lesson));
      setContentTarget(null);
    });
  }

  function startLesson() {
    if (!startTarget) return;
    setError(null);
    startTransition(async () => {
      const result = await startClassSession({
        classId: startTarget.id,
        date: dateKey,
        ...(startTarget.sessionDateId ? { sessionDateId: startTarget.sessionDateId } : {}),
      });
      if (!result.ok) {
        if (result.code === "ACTIVE_SESSION" && result.activeSessionId) {
          router.push(`/staff/sessions/${result.activeSessionId}`);
          return;
        }
        setError(result.message);
        return;
      }
      router.push(`/staff/sessions/${result.sessionId}?view=attendance`);
    });
  }

  function openContacts(lesson: StaffTodayClass) {
    setPeopleTarget(lesson);
  }

  function sendNotice() {
    if (!noticeTarget) return;
    if (!window.confirm("이 수업의 학부모에게 공지와 푸시 알림을 보내시겠습니까?")) return;
    setError(null);
    startTransition(async () => {
      const result = await createStaffClassNotice({ classId: noticeTarget.id, title: noticeTitle, content: noticeContent });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      window.alert(`${result.recipientCount}명에게 공지를 발송했습니다.`);
      setNoticeTarget(null);
      setNoticeTitle("");
      setNoticeContent("");
    });
  }

  function openPrimaryAction(lesson: StaffTodayClass) {
    if (lesson.sessionStatus === "IN_PROGRESS" && lesson.sessionId) {
      router.push(`/staff/sessions/${lesson.sessionId}`);
      return;
    }
    if (runningClass) {
      setError(`${runningClass.name} 수업을 먼저 종료해 주세요.`);
      return;
    }
    setStartTarget(lesson);
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 pb-8 pt-5">
      <header>
        <p className="text-sm font-bold text-[var(--brand-accent)]">{dateKey}</p>
        <div className="mt-1 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-brand-navy-900 dark:text-white">오늘 수업</h1>
            <p className="mt-1 text-sm text-gray-500">준비부터 종료까지 이곳에서 관리하세요.</p>
          </div>
          <span className="material-symbols-outlined rounded-2xl bg-[var(--brand-accent)] p-3 text-[var(--brand-accent-contrast)]">school</span>
        </div>
      </header>

      {classes.length > 0 && (
        <section aria-label="오늘 수업 요약" className="grid grid-cols-3 gap-2">
          <SummaryItem label="전체" value={classes.length} />
          <SummaryItem label="진행 중" value={runningClass ? 1 : 0} accent={Boolean(runningClass)} />
          <SummaryItem label="완료" value={completedCount} />
        </section>
      )}

      {classes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900">
          <span className="material-symbols-outlined text-5xl text-gray-400">event_available</span>
          <p className="mt-3 font-black text-gray-700 dark:text-gray-200">오늘 배정된 수업이 없습니다.</p>
          <p className="mt-1 text-sm text-gray-500">편안한 하루 보내세요.</p>
        </div>
      ) : focusClass ? (
        <>
          {runningClass && (
            <p role="status" className="rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              현재 수업을 종료하기 전에는 다른 수업을 시작할 수 없습니다.
            </p>
          )}
          <section>
            <p className="mb-2 text-sm font-black text-gray-500">{focusClass.sessionStatus === "IN_PROGRESS" ? "현재 수업" : "다음 수업"}</p>
            <article className="overflow-hidden rounded-3xl bg-brand-navy-900 text-white shadow-lg dark:border dark:border-gray-700">
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-black text-[var(--brand-accent)]">{focusClass.startTime}–{focusClass.endTime}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-black">{focusClass.name}</h2>
                      {isSeasonalLesson(focusClass) && <SeasonalBadge inverted />}
                    </div>
                  </div>
                  <StatusBadge status={focusClass.sessionStatus} inverted />
                </div>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-300">
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-lg">groups</span>학생 {focusClass.studentCount}명</span>
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-lg">location_on</span>{focusClass.location || "장소 미정"}</span>
                </div>
                <div className="mt-5 rounded-2xl bg-white/10 p-4">
                  <p className="text-xs font-black text-gray-300">미리 작성한 수업 내용</p>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-white">{focusClass.plannedContent || "아직 작성한 수업 내용이 없습니다."}</p>
                </div>
              </div>
              {focusClass.sessionStatus !== "COMPLETED" && (
                <div className="space-y-2 bg-white/5 p-4">
                  <button type="button" onClick={() => openPrimaryAction(focusClass)} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-accent)] px-4 text-lg font-black text-[var(--brand-accent-contrast)]">
                    <span className="material-symbols-outlined">{focusClass.sessionStatus === "IN_PROGRESS" ? "arrow_forward" : "play_arrow"}</span>
                    {focusClass.sessionStatus === "IN_PROGRESS" ? "수업으로 돌아가기" : "수업 시작"}
                  </button>
                  <div className="grid grid-cols-2 gap-2" aria-label="수업 빠른 메뉴">
                    <SecondaryButton icon="edit_note" label="수업 내용" onClick={() => openContent(focusClass)} disabled={focusClass.sessionStatus === "IN_PROGRESS"} inverted />
                    <SecondaryButton icon="groups" label="학생 정보" onClick={() => setPeopleTarget(focusClass)} inverted />
                    <SecondaryButton icon="receipt_long" label="청구 확인" onClick={() => setBillingTarget({ lesson: focusClass })} inverted />
                    <SecondaryButton icon="campaign" label="수업 공지" onClick={() => { setError(null); setNoticeTarget(focusClass); }} inverted />
                  </div>
                </div>
              )}
            </article>
          </section>

          {otherClasses.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-black dark:text-white">오늘 일정</h2>
                <span className="text-sm font-bold text-gray-500">{otherClasses.length}개</span>
              </div>
              <div className="space-y-3">
                {otherClasses.map((lesson) => (
                  <CompactClassCard key={lesson.scheduleKey} lesson={lesson} startLocked={Boolean(runningClass && lesson.sessionStatus !== "IN_PROGRESS")} onStart={openPrimaryAction} onContent={openContent} onContacts={openContacts} onBilling={(target) => setBillingTarget({ lesson: target })} onNotice={(target) => { setError(null); setNoticeTarget(target); }} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : null}

      {peopleTarget && <ClassPeopleSheet key={`${peopleTarget.id}:${peopleTarget.sessionId || peopleTarget.sessionDateId || "today"}`} open classId={peopleTarget.id} sessionId={peopleTarget.sessionId} sessionDateId={peopleTarget.sessionDateId} className={peopleTarget.name} onClose={() => setPeopleTarget(null)} onOpenBilling={(student) => { const lesson = peopleTarget; setPeopleTarget(null); setBillingTarget({ lesson, student }); }} />}
      {billingTarget && <ClassBillingSheet key={`${billingTarget.lesson.id}:${billingTarget.student?.id || "all"}`} open classId={billingTarget.lesson.id} className={billingTarget.lesson.name} student={billingTarget.student} onClose={() => setBillingTarget(null)} />}

      {noticeTarget && (
        <Modal title="수업 공지 작성" subtitle={`${noticeTarget.name} 학부모에게만 발송합니다.`} onClose={() => setNoticeTarget(null)} labelledBy="notice-title">
          <input value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} placeholder="공지 제목" className="mt-4 min-h-12 w-full rounded-xl border border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800" />
          <textarea value={noticeContent} onChange={(event) => setNoticeContent(event.target.value)} rows={6} placeholder="공지 내용을 입력해 주세요." className="mt-3 w-full rounded-xl border border-gray-200 bg-white p-3 leading-6 dark:border-gray-700 dark:bg-gray-800" />
          <VoiceToTextButton onText={(text) => setNoticeContent((current) => current ? `${current}\n${text}` : text)} />
          <ErrorMessage error={error} />
          <ModalActions pending={pending} onCancel={() => setNoticeTarget(null)} onConfirm={sendNotice} confirmLabel="공지 발송" disabled={!noticeTitle.trim() || !noticeContent.trim()} />
        </Modal>
      )}

      {contentTarget && (
        <Modal title="수업 내용 미리 작성" subtitle={contentTarget.name} onClose={() => setContentTarget(null)} labelledBy="content-title">
          <textarea value={plannedContent} onChange={(event) => setPlannedContent(event.target.value)} rows={7} placeholder="오늘 진행할 내용, 교재 페이지, 준비물 등을 입력하세요." className="mt-4 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm leading-6 outline-none focus:border-[var(--brand-accent)] dark:border-gray-700 dark:bg-gray-800" />
          <VoiceToTextButton onText={(text) => setPlannedContent((current) => current ? `${current}\n${text}` : text)} />
          <ErrorMessage error={error} />
          <ModalActions pending={pending} onCancel={() => setContentTarget(null)} onConfirm={saveContent} confirmLabel="저장" />
        </Modal>
      )}

      {startTarget && (
        <Modal title="수업을 시작하시겠습니까?" subtitle={startTarget.name} onClose={() => setStartTarget(null)} labelledBy="start-title">
          <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm dark:bg-gray-800">
            <p className="font-black dark:text-white">{startTarget.startTime}–{startTarget.endTime}</p>
            <p className="mt-1 text-gray-500">학생 {startTarget.studentCount}명 · {startTarget.location || "장소 미정"}</p>
          </div>
          <p className="mt-3 text-sm leading-6 text-gray-500">확인하면 시작 시간이 기록되고 출석 확인으로 이동합니다.</p>
          <ErrorMessage error={error} />
          <ModalActions pending={pending} onCancel={() => setStartTarget(null)} onConfirm={startLesson} confirmLabel={pending ? "시작 중…" : "수업 시작"} />
        </Modal>
      )}
    </main>
  );
}

function SummaryItem({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return <div className={`rounded-2xl p-3 text-center ${accent ? "bg-[var(--brand-accent)] text-[var(--brand-accent-contrast)]" : "bg-white dark:bg-gray-900"}`}><p className="text-2xl font-black">{value}</p><p className={`mt-0.5 text-xs font-bold ${accent ? "opacity-80" : "text-gray-500"}`}>{label}</p></div>;
}

function StatusBadge({ status, inverted = false }: { status: StaffTodayClass["sessionStatus"]; inverted?: boolean }) {
  const text = status === "COMPLETED" ? "완료" : status === "IN_PROGRESS" ? "수업 중" : "시작 전";
  return <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${status === "IN_PROGRESS" ? "bg-[var(--brand-accent)] text-[var(--brand-accent-contrast)]" : inverted ? "bg-white/10 text-gray-200" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}>{text}</span>;
}

function SeasonalBadge({ inverted = false }: { inverted?: boolean }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${inverted ? "bg-sky-400/20 text-sky-100" : "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-200"}`}>특강</span>;
}

function SecondaryButton({ icon, label, onClick, disabled = false, inverted = false }: { icon: string; label: string; onClick: () => void; disabled?: boolean; inverted?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`flex min-h-16 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold disabled:opacity-40 ${inverted ? "bg-white/10 text-white" : "border border-gray-200 dark:border-gray-700"}`}><span className="material-symbols-outlined text-xl">{icon}</span>{label}</button>;
}

function CompactClassCard({ lesson, startLocked, onStart, onContent, onContacts, onBilling, onNotice }: { lesson: StaffTodayClass; startLocked: boolean; onStart: (lesson: StaffTodayClass) => void; onContent: (lesson: StaffTodayClass) => void; onContacts: (lesson: StaffTodayClass) => void; onBilling: (lesson: StaffTodayClass) => void; onNotice: (lesson: StaffTodayClass) => void }) {
  const completed = lesson.sessionStatus === "COMPLETED";
  return <article className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
    <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-[var(--brand-accent)]">{lesson.startTime}–{lesson.endTime}</p><div className="mt-0.5 flex flex-wrap items-center gap-2"><h3 className="text-lg font-black dark:text-white">{lesson.name}</h3>{isSeasonalLesson(lesson) && <SeasonalBadge />}</div><p className="mt-1 text-xs text-gray-500">학생 {lesson.studentCount}명 · {lesson.location || "장소 미정"}</p></div><StatusBadge status={lesson.sessionStatus} /></div>
    {!completed && <div className="mt-3 space-y-2"><button type="button" disabled={startLocked} title={startLocked ? "진행 중인 수업을 먼저 종료해 주세요." : undefined} onClick={() => onStart(lesson)} className="min-h-12 w-full rounded-xl bg-[var(--brand-accent)] px-4 font-black text-[var(--brand-accent-contrast)] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 dark:disabled:bg-gray-800">{lesson.sessionStatus === "IN_PROGRESS" ? "수업으로 돌아가기" : startLocked ? "현재 수업 종료 후 시작" : "수업 시작"}</button><div className="grid grid-cols-4 gap-2" aria-label="수업 빠른 메뉴"><CompactAction icon="edit_note" label="내용" onClick={() => onContent(lesson)} /><CompactAction icon="groups" label="학생" onClick={() => onContacts(lesson)} /><CompactAction icon="receipt_long" label="청구" onClick={() => onBilling(lesson)} /><CompactAction icon="campaign" label="공지" onClick={() => onNotice(lesson)} /></div></div>}
  </article>;
}

function CompactAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="flex min-h-12 flex-col items-center justify-center rounded-xl border border-gray-200 text-xs font-bold dark:border-gray-700"><span className="material-symbols-outlined text-lg text-[var(--brand-accent)]">{icon}</span>{label}</button>; }

function Modal({ title, subtitle, onClose, labelledBy, scrollable = false, children }: { title: string; subtitle: string; onClose: () => void; labelledBy: string; scrollable?: boolean; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const closeDialog = useCallback(() => onCloseRef.current(), []);
  useStaffDialog(true, dialogRef, closeDialog);
  return <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-4 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-labelledby={labelledBy}><div ref={dialogRef} className={`w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900 ${scrollable ? "max-h-[85vh] overflow-y-auto" : ""}`}><div className="flex items-start justify-between gap-3"><div><h2 id={labelledBy} className="text-xl font-black dark:text-white">{title}</h2><p className="mt-1 text-sm text-gray-500">{subtitle}</p></div><button type="button" aria-label="닫기" data-dialog-initial-focus onClick={onClose} className="min-h-11 min-w-11 rounded-full p-2"><span className="material-symbols-outlined">close</span></button></div>{children}</div></div>;
}

function ModalActions({ pending, onCancel, onConfirm, confirmLabel, disabled = false }: { pending: boolean; onCancel: () => void; onConfirm: () => void; confirmLabel: string; disabled?: boolean }) { return <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" disabled={pending} onClick={onCancel} className="min-h-12 rounded-xl border border-gray-200 font-bold dark:border-gray-700">취소</button><button type="button" disabled={pending || disabled} onClick={onConfirm} className="min-h-12 rounded-xl bg-[var(--brand-accent)] font-black text-[var(--brand-accent-contrast)] disabled:opacity-50">{confirmLabel}</button></div>; }
function ErrorMessage({ error }: { error: string | null }) { return error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null; }
