"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createCoach, updateCoach, deleteCoach, reorderCoaches } from "@/app/actions/admin";
import { compressImageForUpload } from "@/lib/clientImageCompression";
import AdminModal from "@/components/admin/AdminModal";
import AdminQuickActionMenu from "@/components/admin/AdminQuickActionMenu";

interface Coach {
    id: string;
    name: string;
    role: string;
    description: string | null;
    imageUrl: string | null;
    phone: string | null;
    order: number;
}

interface FormState {
    name: string;
    role: string;
    description: string;
    phone: string;
    imageUrl: string;
    imageFile: File | null;
    previewUrl: string | null;
}

type CoachesPayload = {
    coaches: Coach[];
};

function defaultForm(coach?: Coach): FormState {
    return {
        name: coach?.name ?? "",
        role: coach?.role ?? "",
        description: coach?.description ?? "",
        phone: coach?.phone ?? "",
        imageUrl: coach?.imageUrl ?? "",
        imageFile: null,
        previewUrl: coach?.imageUrl ?? null,
    };
}

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

async function uploadImage(file: File): Promise<string> {
    const compressed = await compressImageForUpload(file, { maxEdge: 1200, targetBytes: 600 * 1024 });
    const fd = new FormData();
    fd.append("file", compressed);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error("이미지 업로드 실패");
    const json = await res.json();
    return json.url as string;
}

function CoachPhoto({ url, name }: { url: string | null; name: string }) {
    if (url) {
        return (
            <img
                src={url}
                alt={name}
                className="w-14 h-14 rounded-[3px] object-cover border-2 border-[var(--doc-rule)]"
            />
        );
    }
    return (
        <div className="w-14 h-14 rounded-[3px] bg-[var(--doc-grid-head)] flex items-center justify-center text-[var(--doc-ink-3)] text-xs font-bold shrink-0">
            없음
        </div>
    );
}

function CoachesLoadingFallback() {
    return (
        <div className="space-y-8">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="h-8 w-44 rounded bg-[var(--doc-grid-head)]" />
                    <div className="mt-2 h-4 w-80 max-w-full rounded bg-[var(--doc-grid-head)]" />
                </div>
                <div className="h-10 w-28 rounded-[3px] bg-[var(--doc-grid-head)]" />
            </div>
            <div className="overflow-hidden rounded-[3px] border border-[var(--doc-rule)] bg-[var(--doc-surface)]">
                <div className="flex items-center justify-between border-b border-[var(--doc-rule)] px-6 py-4">
                    <div className="h-5 w-32 rounded bg-[var(--doc-grid-head)]" />
                    <div className="h-4 w-36 rounded bg-[var(--doc-grid-head)]" />
                </div>
                <div className="divide-y divide-[var(--doc-rule)]">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="flex items-center justify-between gap-4 px-6 py-4">
                            <div className="flex min-w-0 flex-1 items-center gap-4">
                                <div className="h-14 w-14 rounded-[3px] bg-[var(--doc-grid-head)]" />
                                <div className="min-w-0 flex-1 space-y-2">
                                    <div className="h-5 w-36 rounded bg-[var(--doc-grid-head)]" />
                                    <div className="h-4 w-56 max-w-full rounded bg-[var(--doc-grid-head)]" />
                                </div>
                            </div>
                            <div className="hidden gap-2 sm:flex">
                                <div className="h-8 w-16 rounded-[3px] bg-[var(--doc-grid-head)]" />
                                <div className="h-8 w-16 rounded-[3px] bg-[var(--doc-grid-head)]" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function CoachesErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="rounded-[6px] border border-[var(--doc-crit)] bg-[var(--doc-surface)] p-8 text-center">
            <span className="material-symbols-outlined mb-3 text-4xl text-[var(--doc-crit)]">error</span>
            <p className="font-bold text-[var(--doc-ink)]">코치 목록을 불러오지 못했습니다.</p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-[3px] bg-[var(--doc-accent)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--doc-grid-head)] dark:text-[var(--doc-ink)]"
            >
                다시 시도
            </button>
        </div>
    );
}

function ImageUploadField({
    form,
    onChange,
}: {
    form: FormState;
    onChange: (patch: Partial<FormState>) => void;
}) {
    const fileRef = useRef<HTMLInputElement>(null);

    function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const previewUrl = URL.createObjectURL(file);
        onChange({ imageFile: file, previewUrl, imageUrl: "" });
    }

    function handleClear() {
        onChange({ imageFile: null, previewUrl: null, imageUrl: "" });
        if (fileRef.current) fileRef.current.value = "";
    }

    const displayUrl = form.previewUrl ?? form.imageUrl;

    return (
        <div>
            <label className="block text-xs font-bold text-[var(--doc-ink-2)] mb-1">
                프로필 사진
                <span className="text-[var(--doc-ink-3)] font-normal ml-1">(직접 업로드)</span>
            </label>
            <div className="flex items-center gap-3">
                {displayUrl ? (
                    <img src={displayUrl} alt="preview" className="w-14 h-14 rounded-[3px] object-cover border border-[var(--doc-rule)] shrink-0" />
                ) : (
                    <div className="w-14 h-14 rounded-[3px] bg-[var(--doc-grid-head)] border border-dashed border-[var(--doc-rule)] flex items-center justify-center text-[var(--doc-ink-3)] text-xs shrink-0">
                        사진
                    </div>
                )}
                <div className="flex-1 space-y-1.5">
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFile}
                        className="block w-full text-sm text-[var(--doc-ink-2)] file:mr-3 file:py-1.5 file:px-3 file:rounded-[3px] file:border-0 file:text-xs file:font-bold file:bg-[var(--doc-accent)] dark:text-[var(--doc-ink)] file:text-white hover:file:bg-[var(--doc-grid-head)] cursor-pointer"
                    />
                    {displayUrl && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-xs text-[var(--doc-crit)] hover:text-[var(--doc-crit)]"
                        >
                            사진 제거
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function CoachesAdminClient({ initialCoaches }: { initialCoaches?: Coach[] }) {
    const [pending, startTransition] = useTransition();
    const hasInitialData = Boolean(initialCoaches);
    const [coaches, setCoaches] = useState<Coach[]>(initialCoaches ?? []);
    const [loading, setLoading] = useState(!hasInitialData);
    const [loadError, setLoadError] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [addForm, setAddForm] = useState<FormState>(defaultForm());
    const [addError, setAddError] = useState<string | null>(null);
    const [editId, setEditId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<FormState>(defaultForm());
    const [editError, setEditError] = useState<string | null>(null);

    // Drag state
    const dragIndex = useRef<number | null>(null);
    const [dragOver, setDragOver] = useState<number | null>(null);

    const loadCoaches = useCallback(async () => {
        setLoading(true);
        setLoadError(false);

        try {
            const response = await fetch("/api/admin/coaches", { cache: "no-store" });
            if (!response.ok) {
                throw new Error("Failed to load coaches.");
            }

            const data = (await response.json()) as CoachesPayload;
            setCoaches(data.coaches);
        } catch (error) {
            console.error("Failed to load coaches:", error);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (hasInitialData) return;
        void loadCoaches();
    }, [hasInitialData, loadCoaches]);

    function patchAdd(patch: Partial<FormState>) {
        setAddForm((f) => ({ ...f, ...patch }));
    }
    function patchEdit(patch: Partial<FormState>) {
        setEditForm((f) => ({ ...f, ...patch }));
    }

    async function handleAdd() {
        if (!addForm.name.trim() || !addForm.role.trim()) return;
        setAddError(null);
        startTransition(async () => {
            try {
                let imageUrl = addForm.imageUrl;
                if (addForm.imageFile) imageUrl = await uploadImage(addForm.imageFile);
                const maxOrder = coaches.length > 0 ? Math.max(...coaches.map((c) => c.order)) : 0;
                await createCoach({
                    name: addForm.name.trim(),
                    role: addForm.role.trim(),
                    description: addForm.description.trim() || undefined,
                    phone: addForm.phone.trim() || undefined,
                    imageUrl: imageUrl.trim() || undefined,
                    order: maxOrder + 1,
                });
                setAddForm(defaultForm());
                setShowAddModal(false);
                await loadCoaches();
            } catch (e: unknown) {
                setAddError(getErrorMessage(e, "추가 실패"));
            }
        });
    }

    function startEdit(coach: Coach) {
        setEditId(coach.id);
        setEditForm(defaultForm(coach));
        setEditError(null);
    }

    function cancelEdit() {
        setEditId(null);
        setEditError(null);
    }

    async function handleUpdate(id: string) {
        setEditError(null);
        startTransition(async () => {
            try {
                let imageUrl = editForm.imageUrl;
                if (editForm.imageFile) imageUrl = await uploadImage(editForm.imageFile);
                const updatedData = {
                    name: editForm.name.trim(),
                    role: editForm.role.trim(),
                    description: editForm.description.trim() || undefined,
                    phone: editForm.phone.trim() || undefined,
                    imageUrl: imageUrl.trim() || undefined,
                };
                await updateCoach(id, updatedData);
                // 로컬 상태도 즉시 업데이트 (새로고침 없이 바로 반영)
                setCoaches((prev) => prev.map((c) => c.id === id ? {
                    ...c,
                    ...updatedData,
                    description: updatedData.description || null,
                    phone: updatedData.phone || null,
                    imageUrl: updatedData.imageUrl || null,
                } : c));
                setEditId(null);
                await loadCoaches();
            } catch (e: unknown) {
                setEditError(getErrorMessage(e, "수정 실패"));
            }
        });
    }

    async function handleDelete(id: string) {
        startTransition(async () => {
            try {
                await deleteCoach(id);
                setCoaches((prev) => prev.filter((c) => c.id !== id));
                await loadCoaches();
            } catch (e: unknown) {
                alert(getErrorMessage(e, "삭제 실패"));
            }
        });
    }

    // ── Drag & Drop handlers ──────────────────────────────────────────────
    function onDragStart(e: React.DragEvent, index: number) {
        dragIndex.current = index;
        e.dataTransfer.effectAllowed = "move";
    }

    function onDragOver(e: React.DragEvent, index: number) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOver(index);
    }

    function onDrop(e: React.DragEvent, dropIndex: number) {
        e.preventDefault();
        const from = dragIndex.current;
        if (from === null || from === dropIndex) {
            dragIndex.current = null;
            setDragOver(null);
            return;
        }
        const previous = [...coaches];
        const next = [...coaches];
        const [moved] = next.splice(from, 1);
        next.splice(dropIndex, 0, moved);
        setCoaches(next);
        dragIndex.current = null;
        setDragOver(null);
        startTransition(async () => {
            try {
                await reorderCoaches(next.map((c) => c.id));
                await loadCoaches();
            } catch (e: unknown) {
                alert(getErrorMessage(e, "순서 변경 실패"));
                setCoaches(previous);
            }
        });
    }

    function onDragEnd() {
        dragIndex.current = null;
        setDragOver(null);
    }

    const INPUT = "w-full border border-[var(--doc-rule)]  rounded-[3px] px-3 py-2.5 text-sm  bg-[var(--doc-grid-head)] focus:bg-[var(--doc-surface)]   focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime focus:border-[var(--doc-accent)]  transition";
    const TEXTAREA = INPUT + " resize-none";

    if (loading && coaches.length === 0) {
        return <CoachesLoadingFallback />;
    }

    if (loadError && coaches.length === 0) {
        return <CoachesErrorState onRetry={loadCoaches} />;
    }

    return (
        <div className="space-y-8">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--doc-ink)] mb-1">코치/강사진 관리</h1>
                    <p className="text-[var(--doc-ink-2)] text-sm">학원소개 페이지 코치진 소개 및 시간표 코치 배정에 사용됩니다.</p>
                </div>
                <button
                    onClick={() => { setAddForm(defaultForm()); setAddError(null); setShowAddModal(true); }}
                    className="shrink-0 bg-[var(--doc-surface)] border border-[var(--doc-rule)] text-[var(--doc-ink)] text-sm font-bold px-4 py-2 rounded-[3px] hover:bg-[var(--doc-grid-head)] transition flex items-center gap-1.5"
                >
                    <span className="text-[var(--doc-accent)]">+</span> 강사 추가
                </button>
            </div>

            {/* 강사 추가 모달 */}
            {showAddModal && (
                <AdminModal onClose={() => setShowAddModal(false)} titleId="add-coach-modal-title" panelClassName="max-w-xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--doc-rule)]">
                            <span id="add-coach-modal-title" className="font-bold text-[var(--doc-ink)] text-base">강사 추가</span>
                            <button onClick={() => setShowAddModal(false)} className="text-[var(--doc-ink-3)] hover:text-[var(--doc-ink-2)] text-xl leading-none">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            {addError && (
                                <div className="bg-[var(--doc-crit-soft)] border border-[var(--doc-crit)] text-[var(--doc-crit)] text-sm rounded-[3px] p-3">
                                    {addError}
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--doc-ink-2)] mb-1">이름 *</label>
                                    <input
                                        type="text"
                                        value={addForm.name}
                                        onChange={(e) => patchAdd({ name: e.target.value })}
                                        placeholder="예: 홍길동"
                                        className={INPUT}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--doc-ink-2)] mb-1">직책 *</label>
                                    <input
                                        type="text"
                                        value={addForm.role}
                                        onChange={(e) => patchAdd({ role: e.target.value })}
                                        placeholder="예: 원장, 수석코치"
                                        className={INPUT}
                                    />
                                </div>
                            </div>
                            {/* 전화번호 — SMS 수신용 (선택) */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--doc-ink-2)] mb-1">
                                    전화번호
                                    <span className="text-[var(--doc-ink-3)] font-normal ml-1">(SMS 수신용, 선택)</span>
                                </label>
                                <input
                                    type="tel"
                                    value={addForm.phone}
                                    onChange={(e) => {
                                        const nums = e.target.value.replace(/\D/g, "").slice(0, 11);
                                        let formatted = nums;
                                        if (nums.length > 7) formatted = `${nums.slice(0,3)}-${nums.slice(3,7)}-${nums.slice(7)}`;
                                        else if (nums.length > 3) formatted = `${nums.slice(0,3)}-${nums.slice(3)}`;
                                        patchAdd({ phone: formatted });
                                    }}
                                    placeholder="숫자만 입력 (자동 변환: 010-1234-5678)"
                                    className={INPUT}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-[var(--doc-ink-2)] mb-1">
                                    약력 / 소개
                                </label>
                                <textarea
                                    value={addForm.description}
                                    onChange={(e) => patchAdd({ description: e.target.value })}
                                    placeholder={"예:\nWKBL 선수 출신 (2010~2018)\n서울대학교 체육교육과 졸업\n대한농구협회 지도자 2급 자격증"}
                                    rows={4}
                                    className={TEXTAREA}
                                />
                            </div>
                            <ImageUploadField form={addForm} onChange={patchAdd} />
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2.5 text-sm text-[var(--doc-ink-2)] border border-[var(--doc-rule)] rounded-[3px] hover:bg-[var(--doc-grid-head)] transition"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleAdd}
                                    disabled={pending || !addForm.name.trim() || !addForm.role.trim()}
                                    className="bg-[var(--doc-ink)] text-white px-6 py-2.5 rounded-[3px] font-bold hover:bg-[var(--doc-grid-head)] transition disabled:opacity-40"
                                >
                                    {pending ? "처리 중..." : "추가하기"}
                                </button>
                            </div>
                        </div>
                </AdminModal>
            )}

            {/* ── 코치 목록 ────────────────────────────────────────────────── */}
            <div className="bg-[var(--doc-surface)] rounded-[3px] border border-[var(--doc-rule)] overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--doc-rule)] flex items-center justify-between">
                    <h2 className="text-base font-bold text-[var(--doc-ink)]">
                        등록된 코치 <span className="text-[var(--doc-accent)]">{coaches.length}명</span>
                    </h2>
                </div>

                {coaches.length === 0 && (
                    <div className="p-10 text-center text-[var(--doc-ink-3)] text-sm">등록된 코치가 없습니다.</div>
                )}

                <ul className="divide-y divide-[var(--doc-rule)]">
                    {coaches.map((coach, i) => (
                        <li
                            key={coach.id}
                            draggable
                            onDragStart={(e) => onDragStart(e, i)}
                            onDragOver={(e) => onDragOver(e, i)}
                            onDrop={(e) => onDrop(e, i)}
                            onDragEnd={onDragEnd}
                            className={`transition-colors ${dragOver === i ? "bg-[var(--doc-grid-head)] border-t-2 border-t-brand-orange-400" : ""}`}
                        >
                            {/* 기본 행 */}
                            <div className="flex items-center gap-4 px-6 py-4">
                                {/* 드래그 핸들 */}
                                <div
                                    className="shrink-0 cursor-grab active:cursor-grabbing text-[var(--doc-ink-3)] hover:text-[var(--doc-ink-2)] transition-colors select-none"
                                    title="드래그하여 순서 변경"
                                >
                                    <svg width="16" height="20" viewBox="0 0 16 20" fill="currentColor">
                                        <circle cx="5" cy="4" r="1.5" />
                                        <circle cx="11" cy="4" r="1.5" />
                                        <circle cx="5" cy="10" r="1.5" />
                                        <circle cx="11" cy="10" r="1.5" />
                                        <circle cx="5" cy="16" r="1.5" />
                                        <circle cx="11" cy="16" r="1.5" />
                                    </svg>
                                </div>

                                {/* 사진 */}
                                <CoachPhoto url={coach.imageUrl} name={coach.name} />

                                {/* 정보 */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                        <span className="font-bold text-[var(--doc-ink)]">{coach.name}</span>
                                        <span className="text-xs bg-[var(--doc-accent)] text-[var(--doc-accent)] border border-[var(--doc-accent)] px-2 py-0.5 rounded-[3px]">
                                            {coach.role}
                                        </span>
                                    </div>
                                    {coach.phone && (
                                        <p className="text-xs text-[var(--doc-ink-2)]">
                                            <span className="material-symbols-outlined text-[13px] align-middle mr-0.5">phone</span>
                                            {coach.phone}
                                        </p>
                                    )}
                                    {coach.description && (
                                        <p className="text-xs text-[var(--doc-ink-2)] whitespace-pre-line line-clamp-2">
                                            {coach.description}
                                        </p>
                                    )}
                                </div>

                                {/* 액션 버튼 */}
                                <div className="shrink-0">
                                    <AdminQuickActionMenu
                                        label={`${coach.name} 빠른 작업`}
                                        actions={[
                                            {
                                                key: "edit",
                                                label: editId === coach.id ? "수정 닫기" : "수정",
                                                icon: editId === coach.id ? "close" : "edit",
                                                onSelect: () => editId === coach.id ? cancelEdit() : startEdit(coach),
                                            },
                                            {
                                                key: "delete",
                                                label: "삭제",
                                                icon: "delete",
                                                tone: "danger",
                                                disabled: pending,
                                                onSelect: () => {
                                                    if (window.confirm(`"${coach.name}" 강사를 삭제할까요?`)) {
                                                        void handleDelete(coach.id);
                                                    }
                                                },
                                            },
                                        ]}
                                    />
                                </div>
                            </div>

                            {/* 편집 폼 (인라인 확장) */}
                            {editId === coach.id && (
                                <div className="bg-[var(--doc-grid-head)] border-t border-[var(--doc-rule)] px-6 py-5">
                                    <h3 className="text-sm font-bold text-[var(--doc-ink-2)] mb-4">코치 정보 수정</h3>
                                    {editError && (
                                        <div className="bg-[var(--doc-crit-soft)] border border-[var(--doc-crit)] text-[var(--doc-crit)] text-sm rounded-[3px] p-3 mb-4">
                                            {editError}
                                        </div>
                                    )}
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-[var(--doc-ink-2)] mb-1">이름 *</label>
                                                <input
                                                    type="text"
                                                    value={editForm.name}
                                                    onChange={(e) => patchEdit({ name: e.target.value })}
                                                    className={INPUT}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-[var(--doc-ink-2)] mb-1">직책 *</label>
                                                <input
                                                    type="text"
                                                    value={editForm.role}
                                                    onChange={(e) => patchEdit({ role: e.target.value })}
                                                    className={INPUT}
                                                />
                                            </div>
                                        </div>

                                        {/* 전화번호 — SMS 수신용 (선택) */}
                                        <div>
                                            <label className="block text-xs font-bold text-[var(--doc-ink-2)] mb-1">
                                                전화번호
                                                <span className="text-[var(--doc-ink-3)] font-normal ml-1">(SMS 수신용, 선택)</span>
                                            </label>
                                            <input
                                                type="tel"
                                                value={editForm.phone}
                                                onChange={(e) => {
                                                    // 숫자만 추출 후 자동 하이픈 포맷팅
                                                    const nums = e.target.value.replace(/\D/g, "").slice(0, 11);
                                                    let formatted = nums;
                                                    if (nums.length > 7) formatted = `${nums.slice(0,3)}-${nums.slice(3,7)}-${nums.slice(7)}`;
                                                    else if (nums.length > 3) formatted = `${nums.slice(0,3)}-${nums.slice(3)}`;
                                                    patchEdit({ phone: formatted });
                                                }}
                                                placeholder="숫자만 입력 (자동 변환: 010-1234-5678)"
                                                className={INPUT}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-[var(--doc-ink-2)] mb-1">약력 / 소개</label>
                                            <textarea
                                                value={editForm.description}
                                                onChange={(e) => patchEdit({ description: e.target.value })}
                                                rows={4}
                                                className={TEXTAREA}
                                            />
                                        </div>

                                        <ImageUploadField form={editForm} onChange={patchEdit} />

                                        <div className="flex justify-end gap-3 pt-2">
                                            <button
                                                onClick={cancelEdit}
                                                className="px-4 py-2 text-sm text-[var(--doc-ink-2)] hover:bg-[var(--doc-grid-head)] rounded-[3px] transition"
                                            >
                                                취소
                                            </button>
                                            <button
                                                onClick={() => handleUpdate(coach.id)}
                                                disabled={pending || !editForm.name.trim() || !editForm.role.trim()}
                                                className="px-5 py-2 text-sm font-bold bg-[var(--doc-accent)] dark:text-[var(--doc-ink)] text-white rounded-[3px] hover:bg-[var(--doc-grid-head)] transition disabled:opacity-40"
                                            >
                                                {pending ? "저장 중..." : "저장하기"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
