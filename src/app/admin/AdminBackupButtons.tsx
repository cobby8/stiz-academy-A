"use client";

import { useState } from "react";

export default function AdminBackupButtons() {
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [ok, setOk] = useState(true);

    function show(text: string, isOk: boolean) {
        setMsg(text);
        setOk(isOk);
    }

    async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm(`"${file.name}" 파일로 복원하시겠습니까?`)) {
            e.target.value = "";
            return;
        }

        setBusy(true);
        setMsg(null);

        try {
            const json = JSON.parse(await file.text());
            const res = await fetch("/api/admin/backup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(json),
            });
            const data = await res.json();
            data.success ? show("복원 완료", true) : show(`오류: ${data.error}`, false);
        } catch {
            show("파일 해석 오류", false);
        } finally {
            setBusy(false);
            e.target.value = "";
        }
    }

    async function handleCloudRestore() {
        if (!confirm("가장 최근 자동 백업으로 복원하시겠습니까?")) return;

        setBusy(true);
        setMsg(null);

        try {
            const listRes = await fetch("/api/admin/cloud-backups");
            const { files } = await listRes.json();

            if (!files?.length) {
                show("클라우드 백업 없음", false);
                return;
            }

            const res = await fetch("/api/admin/cloud-backups", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: files[0].filename }),
            });
            const data = await res.json();
            data.success
                ? show(`복원 완료 (${files[0].filename.slice(12, 27)})`, true)
                : show(`오류: ${data.error}`, false);
        } catch {
            show("복원 실패", false);
        } finally {
            setBusy(false);
        }
    }

    async function handleBackupNow() {
        if (!confirm("지금 즉시 클라우드에 백업하시겠습니까?")) return;

        setBusy(true);
        setMsg(null);

        try {
            const res = await fetch("/api/admin/backup-now", { method: "POST" });
            const data = await res.json();
            data.success
                ? show(`저장 완료 (${data.filename?.slice(12, 27)})`, true)
                : show(`오류: ${data.error}`, false);
        } catch {
            show("백업 실패", false);
        } finally {
            setBusy(false);
        }
    }

    async function handleSyncSchedule() {
        setBusy(true);
        setMsg(null);

        try {
            const res = await fetch("/api/admin/sync-schedule", { method: "POST" });
            const data = await res.json();
            data.success
                ? show(`시트 동기화 완료 (${data.synced}개 슬롯)`, true)
                : show(`오류: ${data.error}`, false);
        } catch {
            show("동기화 실패", false);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-1 px-4 py-2">
            <button
                type="button"
                onClick={handleSyncSchedule}
                disabled={busy}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
                    busy ? "opacity-50" : "text-gray-300 hover:bg-white/10 hover:text-white"
                }`}
            >
                <span className="text-xl">🔄</span>
                <span>시트 동기화</span>
            </button>
            <a
                href="/api/admin/backup"
                className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
            >
                <span className="text-xl">💾</span>
                <span>백업 다운로드</span>
            </a>
            <label
                className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                    busy ? "opacity-50" : "text-gray-300 hover:bg-white/10 hover:text-white"
                }`}
            >
                <span className="text-xl">📂</span>
                <span>{busy ? "처리 중..." : "파일로 복원"}</span>
                <input type="file" accept=".json" className="hidden" onChange={handleRestore} disabled={busy} />
            </label>
            <button
                type="button"
                onClick={handleCloudRestore}
                disabled={busy}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
                    busy ? "opacity-50" : "text-gray-300 hover:bg-white/10 hover:text-white"
                }`}
            >
                <span className="text-xl">☁️</span>
                <span>최신 자동백업 복원</span>
            </button>
            <button
                type="button"
                onClick={handleBackupNow}
                disabled={busy}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
                    busy ? "opacity-50" : "text-gray-300 hover:bg-white/10 hover:text-white"
                }`}
            >
                <span className="text-xl">☁️</span>
                <span>지금 클라우드에 저장</span>
            </button>
            <a
                href="/api/admin/export-seed"
                download="seed-data.ts"
                className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
            >
                <span className="text-xl">📦</span>
                <span>seed 내보내기</span>
            </a>
            {msg && <p className={`break-all px-4 py-1 text-xs ${ok ? "text-green-400" : "text-yellow-400"}`}>{msg}</p>}
        </div>
    );
}
