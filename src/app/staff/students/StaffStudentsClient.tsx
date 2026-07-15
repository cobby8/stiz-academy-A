"use client";
import { useMemo, useState } from "react";
import type { StaffStudentListItem } from "@/lib/staff-portal-queries";

export default function StaffStudentsClient({ students }: { students: StaffStudentListItem[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => { const keyword = query.trim().toLocaleLowerCase("ko"); return keyword ? students.filter((student) => [student.name, student.parentName, student.school, student.grade, ...student.classNames].filter(Boolean).some((value) => value!.toLocaleLowerCase("ko").includes(keyword))) : students; }, [query, students]);
  return <main className="mx-auto max-w-lg space-y-4 px-4 py-5">
    <header><p className="text-sm font-bold text-[var(--brand-accent)]">담당 수업 기준</p><h1 className="mt-1 text-2xl font-black text-brand-navy-900 dark:text-white">학생·학부모 연락</h1><p className="mt-1 text-sm text-gray-500">내가 맡은 수업의 재원생만 표시됩니다.</p></header>
    <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900"><span className="material-symbols-outlined text-gray-400">search</span><span className="sr-only">학생 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="학생, 학부모, 수업명 검색" className="w-full bg-transparent text-sm outline-none" /></label>
    <p className="text-sm font-bold text-gray-500">총 {filtered.length}명</p>
    {filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900">검색 결과가 없습니다.</div> : filtered.map((student) => <article key={student.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-lg font-black dark:text-white">{student.name}</h2><p className="mt-1 text-sm text-gray-500">{[student.school, student.grade].filter(Boolean).join(" · ") || "학교·학년 미등록"}</p>
      <div className="mt-2 flex flex-wrap gap-1">{student.classNames.map((name) => <span key={name} className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">{name}</span>)}</div>
      <div className="mt-4 grid grid-cols-2 gap-2">{student.studentPhone ? <a href={`tel:${student.studentPhone}`} className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-gray-200 font-bold dark:border-gray-700"><span className="material-symbols-outlined text-xl">call</span>학생 전화</a> : <span className="flex min-h-11 items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-400 dark:bg-gray-800">학생 번호 없음</span>}{student.parentPhone ? <a href={`tel:${student.parentPhone}`} className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-[var(--brand-accent)] font-bold text-white"><span className="material-symbols-outlined text-xl">phone_in_talk</span>{student.parentName}</a> : <span className="flex min-h-11 items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-400 dark:bg-gray-800">학부모 번호 없음</span>}</div>
    </article>)}
  </main>;
}
