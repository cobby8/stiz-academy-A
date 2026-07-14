"use client";

import { useRef, useState } from "react";
import { SESSION_IMAGE_ALLOWED_TYPES } from "@/lib/clientImageCompression";
import { uploadImagesWithProgress } from "@/lib/clientImageUpload";

export function SessionPhotoUploader({ sessionId, onUploaded }: { sessionId: string; onUploaded?: (urls: string[]) => void }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length || busy) return;
    setBusy(true);
    setMessage("사진을 압축하고 있습니다.");
    const result = await uploadImagesWithProgress(files, {
      folder: "staff-sessions",
      endpoint: `/api/staff/sessions/${encodeURIComponent(sessionId)}/photos`,
      limit: 10,
      compression: { maxEdge: 1600, targetBytes: 700 * 1024, allowedTypes: SESSION_IMAGE_ALLOWED_TYPES },
      onProgress: (done, total) => setMessage(`사진 등록 중 ${done}/${total}`),
    });
    setBusy(false);
    setMessage(result.failedNames.length ? `${result.failedNames.length}장의 등록에 실패했습니다.` : "관리자 검토 후보로 등록했습니다.");
    onUploaded?.(result.items.map((item) => item.url));
  }

  return <div>
    <input ref={cameraRef} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(e) => void upload(e.target.files)} />
    <input ref={galleryRef} hidden type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => void upload(e.target.files)} />
    <button type="button" disabled={busy} onClick={() => cameraRef.current?.click()}>사진 촬영</button>
    <button type="button" disabled={busy} onClick={() => galleryRef.current?.click()}>갤러리 선택</button>
    {message && <p aria-live="polite">{message}</p>}
  </div>;
}
