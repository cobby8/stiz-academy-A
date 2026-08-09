"use client";

import { useState, useTransition } from "react";
import { recordStudentMediaConsent, revokeStudentMediaConsent } from "@/app/actions/student-media-consent";
import type { StudentMediaConsentAdminView } from "@/lib/studentMediaConsentAdmin";

export default function MediaConsentClient({ data }: { data: StudentMediaConsentAdminView }) {
  const current = data.latest && !data.latest.revokedAt ? data.latest : null;
  const [internalAllowed, setInternalAllowed] = useState(current?.internalAllowed ?? false);
  const [galleryAllowed, setGalleryAllowed] = useState(current?.galleryAllowed ?? false);
  const [instagramAllowed, setInstagramAllowed] = useState(current?.instagramAllowed ?? false);
  const [method, setMethod] = useState("PHONE");
  const [guardianName, setGuardianName] = useState(data.student.guardianName ?? "");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setFeedback(null);
    startTransition(async () => {
      setFeedback(await recordStudentMediaConsent({
        studentId: data.student.id, internalAllowed, galleryAllowed, instagramAllowed, method, guardianName, note,
      }));
    });
  }

  function revoke() {
    if (!window.confirm("사진 사용 동의를 철회할까요? 새 공개는 즉시 차단되지만 이미 외부에 게시된 사진은 별도 삭제 확인이 필요합니다.")) return;
    setFeedback(null);
    startTransition(async () => setFeedback(await revokeStudentMediaConsent({ studentId: data.student.id, note })));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-[6px] border border-[var(--doc-rule)] bg-[var(--doc-surface)] p-5">
        <h2 className="text-lg font-bold text-[var(--doc-ink)]">현재 동의 범위</h2>
        <p className="mt-1 text-sm text-[var(--doc-ink-2)]">넓은 공개 범위는 아래 단계의 동의를 모두 포함해야 합니다.</p>
        <div className="mt-5 space-y-3">
          <ConsentCheck label="학원 내부 보관" description="수업 기록과 관리자 확인용으로 보관" checked={internalAllowed}
            onChange={(value) => { setInternalAllowed(value); if (!value) { setGalleryAllowed(false); setInstagramAllowed(false); } }} />
          <ConsentCheck label="학원 갤러리 공개" description="홈페이지와 학부모 갤러리에 공개" checked={galleryAllowed}
            onChange={(value) => { setGalleryAllowed(value); if (value) setInternalAllowed(true); else setInstagramAllowed(false); }} />
          <ConsentCheck label="인스타그램 공개" description="외부 SNS 게시까지 허용" checked={instagramAllowed}
            onChange={(value) => { setInstagramAllowed(value); if (value) { setInternalAllowed(true); setGalleryAllowed(true); } }} />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold text-[var(--doc-ink-2)]">확인 방법
            <select value={method} onChange={(event) => setMethod(event.target.value)} className="mt-1 w-full rounded-[3px] border border-[var(--doc-rule)] bg-[var(--doc-surface)] px-3 py-2.5">
              <option value="PHONE">전화 확인</option><option value="WRITTEN">서면 동의서</option><option value="IN_PERSON">대면 확인</option><option value="DIGITAL">전자 동의</option>
            </select>
          </label>
          <label className="text-sm font-bold text-[var(--doc-ink-2)]">확인한 보호자
            <input value={guardianName} onChange={(event) => setGuardianName(event.target.value)} maxLength={60} className="mt-1 w-full rounded-[3px] border border-[var(--doc-rule)] bg-[var(--doc-surface)] px-3 py-2.5" />
          </label>
        </div>
        <label className="mt-4 block text-sm font-bold text-[var(--doc-ink-2)]">증빙 메모
          <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} placeholder="확인 일시, 동의서 보관 위치 등" className="mt-1 w-full resize-none rounded-[3px] border border-[var(--doc-rule)] bg-[var(--doc-surface)] px-3 py-2.5" />
        </label>
        {feedback && <p className={`mt-4 rounded-[3px] px-3 py-2 text-sm font-bold ${feedback.ok ? "bg-lime-50 text-lime-800" : "bg-[var(--doc-crit-soft)] text-[var(--doc-crit)]"}`}>{feedback.message}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={save} disabled={pending} className="rounded-[3px] bg-[var(--doc-accent)] px-4 py-2.5 font-bold text-white disabled:opacity-50 dark:text-[var(--doc-ink)]">{pending ? "처리 중..." : "새 동의 이력 저장"}</button>
          <button type="button" onClick={revoke} disabled={pending || !data.latest} className="rounded-[3px] border border-[var(--doc-crit)] px-4 py-2.5 font-bold text-[var(--doc-crit)] disabled:opacity-40">전체 동의 철회</button>
        </div>
      </section>

      <aside className="rounded-[6px] border border-[var(--doc-rule)] bg-[var(--doc-surface)] p-5">
        <h2 className="font-bold text-[var(--doc-ink)]">변경 이력</h2>
        <div className="mt-4 space-y-3">
          {data.history.length === 0 ? <p className="text-sm text-[var(--doc-ink-2)]">아직 기록된 동의가 없습니다.</p> : data.history.map((item, index) => (
            <div key={item.id} className="rounded-[3px] bg-[var(--doc-grid-head)] p-3 text-sm">
              <div className="flex justify-between gap-2"><strong>{index === 0 ? "현재 기록" : "이전 기록"}</strong><span className="text-xs text-[var(--doc-ink-2)]">{new Date(item.recordedAt).toLocaleString("ko-KR")}</span></div>
              <p className="mt-2 text-[var(--doc-ink-2)]">내부 {item.internalAllowed ? "허용" : "차단"} · 갤러리 {item.galleryAllowed ? "허용" : "차단"} · SNS {item.instagramAllowed ? "허용" : "차단"}</p>
              {item.revokedAt && <p className="mt-1 font-bold text-[var(--doc-crit)]">철회 기록</p>}
              {item.evidence?.note && <p className="mt-1 text-xs text-[var(--doc-ink-2)]">{item.evidence.note}</p>}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function ConsentCheck({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-[3px] border border-[var(--doc-rule)] p-4"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-5 w-5 accent-orange-500" /><span><strong className="block text-[var(--doc-ink)]">{label}</strong><span className="text-sm text-[var(--doc-ink-2)]">{description}</span></span></label>;
}

