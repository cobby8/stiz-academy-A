"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { createCoach, updateCoach, deleteCoach, reorderCoaches } from "@/app/actions/admin";

interface Coach {
    id: string;
    name: string;
    role: string;
    description: string | null;
    imageUrl: string | null;
    order: number;
}

interface FormState {
    name: string;
    role: string;
    description: string;
    imageUrl: string;
    imageFile: File | null;
    previewUrl: string | null;
}

function defaultForm(coach?: Coach): FormState {
    return {
        name: coach?.name ?? "",
        role: coach?.role ?? "",
        description: coach?.description ?? "",
        imageUrl: coach?.imageUrl ?? "",
        imageFile: null,
        previewUrl: coach?.imageUrl ?? null,
    };
}

async function uploadImage(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
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
                className="w-14 h-14 rounded-full object-cover border-2 border-gray-200"
            />
        );
    }
    return (
        <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs font-bold shrink-0">
            없음
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
            <label className="block text-xs font-bold text-gray-700 mb-1">
                프로필 사진
                <span className="text-gray-400 font-normal ml-1">(직접 업로드)</span>
            </label>
            <div className="flex items-center gap-3">
                {displayUrl ? (
                    <img src={displayUrl} alt="preview" className="w-14 h-14 rounded-full object-cover border border-gray-200 shrink-0" />
                ) : (
                    <div className="w-14 h-14 rounded-full bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs shrink-0">
                        사진
                    </div>
                )}
                <div className="flex-1 space-y-1.5">
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFile}
                        className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-brand-orange-500 file:text-white hover:file:bg-orange-600 cursor-pointer"
                    />
                    {displayUrl && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-xs text-red-500 hover:text-red-700"
                        >
                            사진 제거
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function CoachesAdminClient({ initialCoaches }: { initialCoaches: Coach[] }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [coaches, setCoaches] = useState<Coach[]>(initialCoaches);
    const [addForm, setAddForm] = useState<FormState>(defaultForm());
    const [addError, setAddError] = useState<string | null>(null);
    const [editId, setEditId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<FormState>(defaultForm());
    const [editError, setEditError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Drag state
    const dragIndex = useRef<number | null>(null);
    const [dragOver, setDragOver] = useState<number | null>(null);

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
                    imageUrl: imageUrl.trim() || undefined,
                    order: maxOrder + 1,
                });
                setAddForm(defaultForm());
                router.refresh();
            } catch (e: any) {
                setAddError(e.message ?? "추가 실패");
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
                await updateCoach(id, {
                    name: editForm.name.trim(),
                    role: editForm.role.trim(),
                    description: editForm.description.trim() || undefined,
                    imageUrl: imageUrl.trim() || undefined,
                });
                setEditId(null);
                router.refresh();
            } catch (e: any) {
                setEditError(e.message ?? "수정 실패");
            }
        });
    }

    async function handleDelete(id: string) {
        startTransition(async () => {
            try {
                await deleteCoach(id);
                setDeleteConfirm(null);
                setCoaches((prev) => prev.filter((c) => c.id !== id));
                router.refresh();
            } catch (e: any) {
                alert(e.message ?? "삭제 실패");
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
        const next = [...coaches];
        const [moved] = next.splice(from, 1);
        next.splice(dropIndex, 0, moved);
        setCoaches(next);
        dragIndex.current = null;
        setDragOver(null);
        startTransition(async () => {
            try {
                await reorderCoaches(next.map((c) => c.id));
                router.refresh();
            } catch (e: any) {
                alert(e.message ?? "순서 변경 실패");
                setCoaches(initialCoaches);
            }
        });
    }

    function onDragEnd() {
        dragIndex.current = null;
        setDragOver(null);
    }

    const INPUT = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-orange-500 focus:border-brand-orange-500 transition";
    const TEXTAREA = INPUT + " resize-none";

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">코치/강사진 관리</h1>
                <p className="text-gray-500 text-sm">학원소개 페이지 코치진 소개 및 시간표 코치 배정에 사용됩니다.</p>
            </div>

            {/* ── 추가 폼 ─────────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-base font-bold text-gray-800 mb-5">코치 추가</h2>

                {addError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
                        {addError}
                    </div>
                )}

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">이름 *</label>
                            <input
                                type="text"
                                value={addForm.name}
                                onChange={(e) => patchAdd({ name: e.target.value })}
                                placeholder="예: 홍길동"
                                className={INPUT}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">직책 *</label>
                            <input
                                type="text"
                                value={addForm.role}
                                onChange={(e) => patchAdd({ role: e.target.value })}
                                placeholder="예: 원장, 수석코치"
                                className={INPUT}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            약력 / 소개
                            <span className="text-gray-400 font-normal ml-1">(경력·자격·한줄 소개 등 자유롭게 기입)</span>
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

                    <div className="flex justify-end pt-2">
                        <button
                            onClick={handleAdd}
                            disabled={pending || !addForm.name.trim() || !addForm.role.trim()}
                            className="bg-brand-navy-900 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-gray-800 transition disabled:opacity-40"
                        >
                            {pending ? "처리 중..." : "추가하기"}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── 코치 목록 ────────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-base font-bold text-gray-800">
                        등록된 코치 <span className="text-brand-orange-500">{coaches.length}명</span>
                    </h2>
                    <p className="text-xs text-gray-400">드래그로 순서를 변경할 수 있습니다</p>
                </div>

                {coaches.length === 0 && (
                    <div className="p-10 text-center text-gray-400 text-sm">등록된 코치가 없습니다.</div>
                )}

                <ul className="divide-y divide-gray-100">
                    {coaches.map((coach, i) => (
                        <li
                            key={coach.id}
                            draggable
                            onDragStart={(e) => onDragStart(e, i)}
                            onDragOver={(e) => onDragOver(e, i)}
                            onDrop={(e) => onDrop(e, i)}
                            onDragEnd={onDragEnd}
                            className={`transition-colors ${dragOver === i ? "bg-orange-50 border-t-2 border-t-brand-orange-400" : ""}`}
                        >
                            {/* 기본 행 */}
                            <div className="flex items-center gap-4 px-6 py-4">
                                {/* 드래그 핸들 */}
                                <div
                                    className="shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors select-none"
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
                                        <span className="font-bold text-gray-900">{coach.name}</span>
                                        <span className="text-xs bg-brand-orange-50 text-brand-orange-600 border border-brand-orange-200 px-2 py-0.5 rounded-full">
                                            {coach.role}
                                        </span>
                                    </div>
                                    {coach.description && (
                                        <p className="text-xs text-gray-500 whitespace-pre-line line-clamp-2">
                                            {coach.description}
                                        </p>
                                    )}
                                </div>

                                {/* 액션 버튼 */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => editId === coach.id ? cancelEdit() : startEdit(coach)}
                                        className="text-sm font-bold text-brand-navy-900 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition"
                                    >
                                        {editId === coach.id ? "취소" : "수정"}
                                    </button>
                                    {deleteConfirm === coach.id ? (
                                        <>
                                            <button
                                                onClick={() => handleDelete(coach.id)}
                                                disabled={pending}
                                                className="text-sm font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                                            >
                                                확인
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirm(null)}
                                                className="text-sm text-gray-500 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition"
                                            >
                                                취소
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => setDeleteConfirm(coach.id)}
                                            className="text-sm font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition"
                                        >
                                            삭제
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* 편집 폼 (인라인 확장) */}
                            {editId === coach.id && (
                                <div className="bg-blue-50 border-t border-blue-200 px-6 py-5">
                                    <h3 className="text-sm font-bold text-blue-800 mb-4">코치 정보 수정</h3>
                                    {editError && (
                                        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
                                            {editError}
                                        </div>
                                    )}
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 mb-1">이름 *</label>
                                                <input
                                                    type="text"
                                                    value={editForm.name}
                                                    onChange={(e) => patchEdit({ name: e.target.value })}
                                                    className={INPUT}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 mb-1">직책 *</label>
                                                <input
                                                    type="text"
                                                    value={editForm.role}
                                                    onChange={(e) => patchEdit({ role: e.target.value })}
                                                    className={INPUT}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">약력 / 소개</label>
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
                                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                            >
                                                취소
                                            </button>
                                            <button
                                                onClick={() => handleUpdate(coach.id)}
                                                disabled={pending || !editForm.name.trim() || !editForm.role.trim()}
                                                className="px-5 py-2 text-sm font-bold bg-brand-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-40"
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
