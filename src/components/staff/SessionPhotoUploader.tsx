"use client";

import { useRef, useState } from "react";
import { SESSION_IMAGE_ALLOWED_TYPES } from "@/lib/clientImageCompression";
import { uploadImagesWithProgress } from "@/lib/clientImageUpload";

type PhotoSubject = { id: string; name: string };

export function SessionPhotoUploader({
  sessionId,
  students,
  onUploaded,
}: {
  sessionId: string;
  students: PhotoSubject[];
  onUploaded?: (urls: string[]) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [subjectStudentIds, setSubjectStudentIds] = useState<string[]>([]);

  function toggleSubject(studentId: string) {
    setSubjectStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId],
    );
  }

  async function upload(files: FileList | null) {
    if (!files?.length || busy) return;
    if (subjectStudentIds.length === 0) {
      setMessage("사진에 나온 학생을 한 명 이상 선택해 주세요.");
      return;
    }

    setBusy(true);
    setMessage("사진을 압축하고 있습니다.");
    const result = await uploadImagesWithProgress(files, {
      folder: "staff-sessions",
      endpoint: `/api/staff/sessions/${encodeURIComponent(sessionId)}/photos`,
      fields: { subjectStudentIds: JSON.stringify(subjectStudentIds) },
      limit: 10,
      compression: {
        maxEdge: 1600,
        targetBytes: 700 * 1024,
        allowedTypes: SESSION_IMAGE_ALLOWED_TYPES,
      },
      onProgress: (done, total) => setMessage(`사진 등록 중 ${done}/${total}`),
    });

    setBusy(false);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
    setMessage(
      result.failedNames.length
        ? `${result.failedNames.length}장의 등록에 실패했습니다.`
        : "관리자 검토용 비공개 초안으로 등록했습니다.",
    );
    onUploaded?.(result.items.map((item) => item.url));
  }

  return (
    <div className="space-y-3">
      <fieldset disabled={busy}>
        <legend className="text-sm font-bold text-gray-700 dark:text-gray-200">
          사진에 나온 학생 <span className="text-red-600">(필수)</span>
        </legend>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          선택한 학생의 보호자 동의가 확인된 사진만 관리자가 갤러리나 인스타그램에 게시할 수 있습니다.
        </p>
        <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          {students.map((student) => {
            const selected = subjectStudentIds.includes(student.id);
            return (
              <button
                key={student.id}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleSubject(student.id)}
                className={`min-h-10 rounded-full border px-3 text-sm font-bold ${
                  selected
                    ? "border-[var(--brand-accent)] bg-[var(--brand-accent)] text-[var(--brand-accent-contrast)]"
                    : "border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                }`}
              >
                {selected ? "✓ " : ""}{student.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <input ref={cameraRef} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => void upload(event.target.files)} />
      <input ref={galleryRef} hidden type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => void upload(event.target.files)} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={busy || subjectStudentIds.length === 0} onClick={() => cameraRef.current?.click()} className="min-h-12 rounded-xl bg-[var(--brand-accent)] px-3 font-black text-[var(--brand-accent-contrast)] disabled:opacity-50">
          사진 촬영
        </button>
        <button type="button" disabled={busy || subjectStudentIds.length === 0} onClick={() => galleryRef.current?.click()} className="min-h-12 rounded-xl border border-gray-200 bg-white px-3 font-black disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800">
          갤러리 선택
        </button>
      </div>
      {message && <p aria-live="polite" className="text-sm font-bold text-gray-600 dark:text-gray-300">{message}</p>}
    </div>
  );
}
