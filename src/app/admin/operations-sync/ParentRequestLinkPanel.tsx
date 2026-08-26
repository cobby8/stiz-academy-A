"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createParentOperationsRequestLink, getActiveParentOperationsRequestLinks, revokeParentOperationsRequestLink, type ActiveParentOperationsLink } from "@/app/actions/parent-operations-request";

export type ParentRequestLinkStudent = {
  id: string;
  name: string;
  grade: string | null;
  parentPhoneLast4: string | null;
};

export type ParentRequestLinkResult = { url: string; expiresAt: string };

export default function ParentRequestLinkPanel({ students }: { students: ParentRequestLinkStudent[] }) {
  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const [result, setResult] = useState<ParentRequestLinkResult | null>(null);
  const [message, setMessage] = useState("");
  const [activeLinks, setActiveLinks] = useState<ActiveParentOperationsLink[]>([]);
  const [isPending, startTransition] = useTransition();

  const filteredStudents = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("ko-KR");
    if (!keyword) return students.slice(0, 12);
    return students.filter((student) => student.name.toLocaleLowerCase("ko-KR").includes(keyword)).slice(0, 12);
  }, [query, students]);

  function refreshLinks() {
    startTransition(async () => {
      try { setActiveLinks(await getActiveParentOperationsRequestLinks()); }
      catch { setMessage("활성 링크 목록을 불러오지 못했습니다."); }
    });
  }

  useEffect(() => { refreshLinks(); }, []); // 최초 한 번만 관리자용 활성 링크를 조회한다.

  function generate() {
    if (!studentId) return;
    startTransition(async () => {
      try {
        const next = await createParentOperationsRequestLink(studentId);
        setResult({ url: `${window.location.origin}/request/${next.token}`, expiresAt: new Date(next.expiresAt).toISOString() });
        setMessage("학생 정보가 노출되지 않는 전용 링크를 만들었습니다.");
        refreshLinks();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "요청 링크를 만들지 못했습니다.");
      }
    });
  }

  function revoke(linkId: string) {
    startTransition(async () => {
      try {
        await revokeParentOperationsRequestLink(linkId);
        setActiveLinks((links) => links.filter((link) => link.id !== linkId));
        setMessage("요청 링크를 취소했습니다.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "링크를 취소하지 못했습니다.");
      }
    });
  }

  async function copyLink() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setMessage("링크를 복사했습니다. 전화나 문자로 전달해 주세요.");
    } catch {
      setMessage("자동 복사가 막혔습니다. 아래 링크를 길게 눌러 복사해 주세요.");
    }
  }

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm dark:border-blue-900 dark:bg-blue-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">학부모 전달용</p>
          <h2 className="mt-1 text-lg font-black text-gray-950 dark:text-white">학생별 요청 링크 만들기</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">링크에는 이름·전화번호가 들어가지 않습니다. 학부모가 제출해도 원장 승인 전에는 아무것도 바뀌지 않습니다.</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-700 shadow-sm dark:bg-gray-900 dark:text-blue-200">승인 후 반영</span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
          학생 찾기
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="학생 이름 입력" className="mt-2 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 dark:border-gray-600 dark:bg-gray-950" />
        </label>
        <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
          전달할 학생
          <select value={studentId} onChange={(event) => { setStudentId(event.target.value); setResult(null); }} className="mt-2 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 dark:border-gray-600 dark:bg-gray-950">
            <option value="">학생을 선택하세요</option>
            {filteredStudents.map((student) => <option key={student.id} value={student.id}>{student.name}{student.grade ? ` · ${student.grade}` : ""}{student.parentPhoneLast4 ? ` · 보호자 ${student.parentPhoneLast4}` : ""}</option>)}
          </select>
        </label>
        <button type="button" disabled={!studentId || isPending} onClick={generate} className="min-h-11 rounded-xl bg-blue-700 px-5 font-black text-white disabled:opacity-50">{isPending ? "만드는 중…" : "링크 만들기"}</button>
      </div>

      {result ? <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4 dark:border-blue-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input readOnly value={result.url} aria-label="학부모 요청 링크" className="min-h-11 min-w-0 flex-1 rounded-lg bg-gray-100 px-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200" />
          <button type="button" onClick={copyLink} className="min-h-11 rounded-lg border border-blue-300 px-4 text-sm font-black text-blue-700 dark:border-blue-700 dark:text-blue-200">링크 복사</button>
        </div>
        <p className="mt-2 text-xs font-bold text-gray-500">만료: {new Date(result.expiresAt).toLocaleString("ko-KR")} · 만료 후에는 새 링크를 만들어야 합니다.</p>
      </div> : null}
      <p role="status" className="mt-3 text-sm font-bold text-blue-800 dark:text-blue-200">{message}</p>
      {activeLinks.length > 0 ? <div className="mt-5 border-t border-blue-200 pt-4 dark:border-blue-900">
        <h3 className="text-sm font-black text-gray-900 dark:text-white">아직 사용할 수 있는 링크</h3>
        <ul className="mt-2 space-y-2">
          {activeLinks.map((link) => <li key={link.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm dark:bg-gray-900">
            <span><b>{link.studentName}</b><span className="ml-2 text-xs text-gray-500">{new Date(link.expiresAt).toLocaleString("ko-KR")} 만료</span></span>
            <button type="button" disabled={isPending} onClick={() => revoke(link.id)} className="min-h-9 rounded-lg border border-red-200 px-3 text-xs font-black text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-300">취소</button>
          </li>)}
        </ul>
      </div> : null}
    </section>
  );
}
