"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  savePlannedClassContent,
  startClassSession,
} from "@/app/actions/staff-sessions";
import {
  createStaffClassNotice,
  loadStaffClassContacts,
} from "@/app/actions/staff-notices";
import { VoiceToTextButton } from "@/components/staff/VoiceToTextButton";
import type { StaffTodayClass } from "@/lib/staff-session-queries";

type StaffContact = Awaited<ReturnType<typeof loadStaffClassContacts>>[number];

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
  const [contactTarget, setContactTarget] = useState<StaffTodayClass | null>(null);
  const [contacts, setContacts] = useState<StaffContact[]>([]);
  const [noticeTarget, setNoticeTarget] = useState<StaffTodayClass | null>(null);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openContent(lesson: StaffTodayClass) {
    setError(null);
    setContentTarget(lesson);
    setPlannedContent(lesson.plannedContent || "");
  }

  function saveContent() {
    if (!contentTarget) return;
    setError(null);
    startTransition(async () => {
      const result = await savePlannedClassContent({
        classId: contentTarget.id,
        date: dateKey,
        plannedContent,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setClasses((current) =>
        current.map((lesson) =>
          lesson.id === contentTarget.id
            ? {
                ...lesson,
                sessionId: result.sessionId,
                sessionStatus: "PLANNED",
                plannedContent,
              }
            : lesson,
        ),
      );
      setContentTarget(null);
    });
  }

  function startLesson() {
    if (!startTarget) return;
    setError(null);
    startTransition(async () => {
      const result = await startClassSession({ classId: startTarget.id, date: dateKey });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/staff/sessions/${result.sessionId}?view=attendance`);
    });
  }

  function openContacts(lesson: StaffTodayClass) {
    setError(null);
    setContactTarget(lesson);
    setContacts([]);
    startTransition(async () => {
      try {
        setContacts(await loadStaffClassContacts(lesson.id));
      } catch {
        setError("학생·학부모 명단을 불러오지 못했습니다.");
      }
    });
  }

  function sendNotice() {
    if (!noticeTarget) return;
    if (!window.confirm("이 수업의 학부모에게 공지와 푸시 알림을 보내시겠습니까?")) return;
    setError(null);
    startTransition(async () => {
      const result = await createStaffClassNotice({
        classId: noticeTarget.id,
        title: noticeTitle,
        content: noticeContent,
      });
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

  return (
    <main className="mx-auto max-w-lg space-y-5 px-4 py-5">
      <section>
        <p className="text-sm font-bold text-[var(--brand-accent)]">{dateKey}</p>
        <h1 className="mt-1 text-2xl font-black text-brand-navy-900 dark:text-white">오늘 수업</h1>
        <p className="mt-1 text-sm text-gray-500">수업 준비부터 종료까지 휴대폰에서 관리할 수 있습니다.</p>
      </section>

      {classes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
          <span className="material-symbols-outlined text-4xl text-gray-400">event_available</span>
          <p className="mt-2 font-bold text-gray-700 dark:text-gray-200">오늘 배정된 수업이 없습니다.</p>
        </div>
      ) : (
        classes.map((lesson) => {
          const running = lesson.sessionStatus === "IN_PROGRESS";
          const completed = lesson.sessionStatus === "COMPLETED";
          return (
            <article key={lesson.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[var(--brand-accent)]">{lesson.startTime}~{lesson.endTime}</p>
                  <h2 className="mt-1 text-xl font-black dark:text-white">{lesson.name}</h2>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {completed ? "종료" : running ? "수업 중" : "시작 전"}
                </span>
              </div>
              <div className="mt-4 flex gap-4 text-sm text-gray-500">
                <span>학생 {lesson.studentCount}명</span>
                <span>{lesson.location || "장소 미지정"}</span>
              </div>
              <p className="mt-4 line-clamp-3 rounded-xl bg-gray-50 p-3 text-sm leading-6 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                {lesson.plannedContent || "아직 작성된 수업 내용이 없습니다."}
              </p>
              {!running && !completed && (
                <button type="button" onClick={() => openContent(lesson)} className="mt-3 min-h-11 w-full rounded-xl border border-gray-200 font-black dark:border-gray-700">
                  수업 내용 미리 작성
                </button>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openContacts(lesson)}
                  className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-gray-200 font-bold dark:border-gray-700"
                >
                  <span className="material-symbols-outlined text-xl">call</span>
                  명단·전화
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setNoticeTarget(lesson);
                  }}
                  className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-gray-200 font-bold dark:border-gray-700"
                >
                  <span className="material-symbols-outlined text-xl">campaign</span>
                  수업 공지
                </button>
              </div>
              <button
                type="button"
                disabled={completed}
                onClick={() => running && lesson.sessionId ? router.push(`/staff/sessions/${lesson.sessionId}`) : setStartTarget(lesson)}
                className="mt-3 min-h-12 w-full rounded-xl bg-[var(--brand-accent)] px-4 font-black text-[var(--brand-accent-contrast)] disabled:opacity-50"
              >
                {completed ? "수업 완료" : running ? "수업으로 돌아가기" : "수업 시작"}
              </button>
            </article>
          );
        })
      )}

      {contactTarget && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-4 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-labelledby="contact-title">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="contact-title" className="text-xl font-black dark:text-white">학생·학부모 명단</h2>
                <p className="mt-1 text-sm text-gray-500">{contactTarget.name}</p>
              </div>
              <button type="button" aria-label="닫기" onClick={() => setContactTarget(null)} className="rounded-full p-2">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {pending && contacts.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">명단을 불러오는 중입니다.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {contacts.map((contact) => (
                  <div key={`${contact.studentId}-${contact.guardianId || "parent"}`} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                    <p className="font-black dark:text-white">{contact.studentName}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm">
                      {contact.parentPhone && <a href={`tel:${contact.parentPhone}`} className="rounded-lg bg-gray-100 px-3 py-2 font-bold dark:bg-gray-800">학부모 {contact.parentName} 전화</a>}
                      {contact.guardianPhone && <a href={`tel:${contact.guardianPhone}`} className="rounded-lg bg-gray-100 px-3 py-2 font-bold dark:bg-gray-800">{contact.guardianRelation || "보호자"} {contact.guardianName} 전화</a>}
                    </div>
                  </div>
                ))}
                {contacts.length === 0 && <p className="py-8 text-center text-sm text-gray-500">등록된 연락처가 없습니다.</p>}
              </div>
            )}
            {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
          </div>
        </div>
      )}

      {noticeTarget && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-4 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-labelledby="notice-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <h2 id="notice-title" className="text-xl font-black dark:text-white">수업 공지 작성</h2>
            <p className="mt-1 text-sm text-gray-500">{noticeTarget.name} 학부모에게만 발송됩니다.</p>
            <input value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} placeholder="공지 제목" className="mt-4 min-h-12 w-full rounded-xl border border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800" />
            <textarea value={noticeContent} onChange={(event) => setNoticeContent(event.target.value)} rows={6} placeholder="공지 내용을 입력해 주세요." className="mt-3 w-full rounded-xl border border-gray-200 bg-white p-3 leading-6 dark:border-gray-700 dark:bg-gray-800" />
            <VoiceToTextButton onText={(text) => setNoticeContent((current) => current ? `${current}\n${text}` : text)} />
            {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" disabled={pending} onClick={() => setNoticeTarget(null)} className="min-h-12 rounded-xl border border-gray-200 font-bold dark:border-gray-700">취소</button>
              <button type="button" disabled={pending || !noticeTitle.trim() || !noticeContent.trim()} onClick={sendNotice} className="min-h-12 rounded-xl bg-[var(--brand-accent)] font-black text-[var(--brand-accent-contrast)] disabled:opacity-50">공지 발송</button>
            </div>
          </div>
        </div>
      )}

      {contentTarget && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-4 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-labelledby="content-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <h2 id="content-title" className="text-xl font-black dark:text-white">수업 내용 미리 작성</h2>
            <p className="mt-1 text-sm text-gray-500">{contentTarget.name}</p>
            <textarea
              value={plannedContent}
              onChange={(event) => setPlannedContent(event.target.value)}
              rows={7}
              placeholder="오늘 진행할 내용, 교재 페이지, 준비물 등을 입력하세요."
              className="mt-4 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm leading-6 outline-none focus:border-[var(--brand-accent)] dark:border-gray-700 dark:bg-gray-800"
            />
            <VoiceToTextButton onText={(text) => setPlannedContent((current) => current ? `${current}\n${text}` : text)} />
            {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" disabled={pending} onClick={() => setContentTarget(null)} className="min-h-12 rounded-xl border border-gray-200 font-bold dark:border-gray-700">취소</button>
              <button type="button" disabled={pending} onClick={saveContent} className="min-h-12 rounded-xl bg-[var(--brand-accent)] font-black text-[var(--brand-accent-contrast)]">저장</button>
            </div>
          </div>
        </div>
      )}

      {startTarget && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-4 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-labelledby="start-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <h2 id="start-title" className="text-xl font-black dark:text-white">수업을 시작하시겠습니까?</h2>
            <p className="mt-3 font-bold dark:text-gray-100">{startTarget.name}</p>
            <p className="mt-1 text-sm text-gray-500">{startTarget.startTime}~{startTarget.endTime} · 학생 {startTarget.studentCount}명</p>
            {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" disabled={pending} onClick={() => setStartTarget(null)} className="min-h-12 rounded-xl border border-gray-200 font-bold dark:border-gray-700">취소</button>
              <button type="button" disabled={pending} onClick={startLesson} className="min-h-12 rounded-xl bg-[var(--brand-accent)] font-black text-[var(--brand-accent-contrast)]">{pending ? "시작 중…" : "수업 시작"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
