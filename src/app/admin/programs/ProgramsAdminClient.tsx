"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProgram, updateProgram, deleteProgram } from "@/app/actions/admin";

const WEEKLY_FREQ_OPTIONS = [
    { value: "주1회", label: "주 1회" },
    { value: "주2회", label: "주 2회" },
    { value: "주3회", label: "주 3회" },
    { value: "매일반", label: "매일반" },
];

function getShuttleFee(freq: string): string | null {
    if (freq === "주1회") return "10,000원 / 월";
    if (freq === "주2회") return "15,000원 / 월";
    if (freq === "주3회" || freq === "매일반") return "20,000원 / 월";
    return null;
}

interface Program {
    id: string;
    name: string;
    targetAge: string | null;
    weeklyFrequency: string | null;
    frequency: string | null;
    description: string | null;
    price: number;
}

interface ProgramForm {
    name: string;
    targetAge: string;
    weeklyFrequency: string;
    description: string;
    price: string;
}

function emptyForm(): ProgramForm {
    return { name: "", targetAge: "", weeklyFrequency: "", description: "", price: "" };
}

const INPUT = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-orange-500 focus:border-brand-orange-500 bg-gray-50 focus:bg-white";
const SELECT = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-orange-500 focus:border-brand-orange-500 bg-gray-50 focus:bg-white";

function ProgramForm({
    form,
    onChange,
    onSubmit,
    onCancel,
    submitLabel,
    pending,
}: {
    form: ProgramForm;
    onChange: (f: ProgramForm) => void;
    onSubmit: () => void;
    onCancel?: () => void;
    submitLabel: string;
    pending: boolean;
}) {
    const p = (patch: Partial<ProgramForm>) => onChange({ ...form, ...patch });
    const shuttleFee = getShuttleFee(form.weeklyFrequency);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">프로그램명 *</label>
                <input type="text" value={form.name} onChange={(e) => p({ name: e.target.value })} placeholder="예: 정규 클래스 (취미/기초)" className={INPUT} />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">대상 연령</label>
                <input type="text" value={form.targetAge} onChange={(e) => p({ targetAge: e.target.value })} placeholder="예: 초등/중등" className={INPUT} />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">수업 빈도 (주)</label>
                <select value={form.weeklyFrequency} onChange={(e) => p({ weeklyFrequency: e.target.value })} className={SELECT}>
                    <option value="">-- 선택 --</option>
                    {WEEKLY_FREQ_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
                {form.weeklyFrequency && (
                    <div className={`mt-2 text-xs px-3 py-2 rounded-lg font-medium flex items-center gap-1.5 ${shuttleFee ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-gray-50 text-gray-500 border border-gray-200"}`}>
                        🚌 셔틀비: {shuttleFee || "주말 셔틀 운행 없음"}
                    </div>
                )}
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">수업료 (월) *</label>
                <div className="relative">
                    <input
                        type="number"
                        value={form.price}
                        onChange={(e) => p({ price: e.target.value })}
                        placeholder="150000"
                        min={0}
                        className={INPUT + " pr-8"}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">원</span>
                </div>
                {form.price && !isNaN(Number(form.price)) && Number(form.price) > 0 && (
                    <p className="text-xs text-gray-500 mt-1">{Number(form.price).toLocaleString()}원 / 월</p>
                )}
            </div>
            <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">프로그램 설명</label>
                <textarea
                    value={form.description}
                    onChange={(e) => p({ description: e.target.value })}
                    rows={2}
                    placeholder="기초 체력과 기본기를 다지는 클래스입니다."
                    className={INPUT}
                />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
                {onCancel && (
                    <button type="button" onClick={onCancel} className="border border-gray-300 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition">
                        취소
                    </button>
                )}
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={pending || !form.name.trim() || !form.price}
                    className="bg-brand-navy-900 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-40 shadow-sm"
                >
                    {pending ? "저장 중..." : submitLabel}
                </button>
            </div>
        </div>
    );
}

export default function ProgramsAdminClient({
    programs: initialPrograms,
}: {
    programs: Program[];
}) {
    const router = useRouter();
    const [addForm, setAddForm] = useState<ProgramForm>(emptyForm);
    const [editId, setEditId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<ProgramForm>(emptyForm);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [addPending, startAddTransition] = useTransition();
    const [editPending, startEditTransition] = useTransition();
    const [deletePending, startDeleteTransition] = useTransition();

    function handleAdd() {
        if (!addForm.name.trim() || !addForm.price) return;
        startAddTransition(async () => {
            try {
                await createProgram({
                    name: addForm.name.trim(),
                    targetAge: addForm.targetAge.trim() || undefined,
                    weeklyFrequency: addForm.weeklyFrequency || undefined,
                    description: addForm.description.trim() || undefined,
                    price: parseInt(addForm.price) || 0,
                });
                setAddForm(emptyForm());
                router.refresh();
            } catch (e: any) {
                alert(e.message || "저장 실패");
            }
        });
    }

    function startEdit(p: Program) {
        setEditId(p.id);
        setEditForm({
            name: p.name,
            targetAge: p.targetAge ?? "",
            weeklyFrequency: p.weeklyFrequency ?? "",
            description: p.description ?? "",
            price: String(p.price),
        });
    }

    function handleUpdate() {
        if (!editForm.name.trim() || !editId) return;
        startEditTransition(async () => {
            try {
                await updateProgram(editId, {
                    name: editForm.name.trim(),
                    targetAge: editForm.targetAge.trim() || undefined,
                    weeklyFrequency: editForm.weeklyFrequency || undefined,
                    description: editForm.description.trim() || undefined,
                    price: parseInt(editForm.price) || 0,
                });
                setEditId(null);
                router.refresh();
            } catch (e: any) {
                alert(e.message || "수정 실패");
            }
        });
    }

    function handleDelete(id: string) {
        startDeleteTransition(async () => {
            try {
                await deleteProgram(id);
                setDeletingId(null);
                router.refresh();
            } catch (e: any) {
                alert(e.message || "삭제 실패");
            }
        });
    }

    const SHUTTLE_INFO = [
        { freq: "주1회", fee: "10,000원" },
        { freq: "주2회", fee: "15,000원" },
        { freq: "주3회 / 매일반", fee: "20,000원" },
        { freq: "주말 수업", fee: "셔틀 운행 없음" },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">프로그램(커리큘럼) 관리</h1>
                <p className="text-gray-500">학원에서 운영하는 교육 프로그램을 등록하고 관리합니다.</p>
            </div>

            {/* Shuttle fee reference */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-bold text-blue-800 mb-2">🚌 셔틀버스 요금 기준</p>
                <div className="flex flex-wrap gap-3">
                    {SHUTTLE_INFO.map((s) => (
                        <div key={s.freq} className="flex items-center gap-1.5 text-xs bg-white border border-blue-200 rounded-lg px-3 py-1.5">
                            <span className="font-medium text-blue-700">{s.freq}</span>
                            <span className="text-gray-400">→</span>
                            <span className="font-bold text-blue-900">{s.fee}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add Form */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4">새 프로그램 등록</h2>
                <ProgramForm
                    form={addForm}
                    onChange={setAddForm}
                    onSubmit={handleAdd}
                    submitLabel="저장하기"
                    pending={addPending}
                />
            </div>

            {/* Program List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <h2 className="text-lg font-bold text-gray-900 p-6 border-b border-gray-100 bg-gray-50/50">등록된 프로그램 목록</h2>
                <ul className="divide-y divide-gray-100">
                    {initialPrograms.length === 0 && (
                        <li className="p-8 text-center text-gray-500">등록된 프로그램이 없습니다.</li>
                    )}
                    {initialPrograms.map((program, i) => (
                        <li key={program.id} className="p-6 hover:bg-gray-50/50 transition">
                            {editId === program.id ? (
                                <div>
                                    <p className="text-sm font-bold text-blue-700 mb-3">수정 중...</p>
                                    <ProgramForm
                                        form={editForm}
                                        onChange={setEditForm}
                                        onSubmit={handleUpdate}
                                        onCancel={() => setEditId(null)}
                                        submitLabel="저장"
                                        pending={editPending}
                                    />
                                </div>
                            ) : (
                                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                                    <div className="flex-1">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <span className="bg-brand-navy-900 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                                                {i + 1}
                                            </span>
                                            <h3 className="font-bold text-gray-900 text-lg">{program.name}</h3>
                                            {(program.weeklyFrequency || program.frequency) && (
                                                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                                                    {program.weeklyFrequency || program.frequency}
                                                </span>
                                            )}
                                            {program.targetAge && (
                                                <span className="bg-orange-50 text-orange-600 text-xs font-bold px-2.5 py-0.5 rounded-full border border-orange-200">
                                                    {program.targetAge}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 mt-1">
                                            <span>
                                                <span className="text-gray-400">수강료</span>{" "}
                                                <strong className="text-brand-navy-900">{program.price.toLocaleString()}원 / 월</strong>
                                            </span>
                                            {program.weeklyFrequency && getShuttleFee(program.weeklyFrequency) && (
                                                <span>
                                                    <span className="text-gray-400">셔틀비</span>{" "}
                                                    <strong className="text-blue-700">{getShuttleFee(program.weeklyFrequency)}</strong>
                                                </span>
                                            )}
                                        </div>
                                        {program.description && (
                                            <p className="text-sm text-gray-500 mt-2">{program.description}</p>
                                        )}
                                    </div>

                                    <div className="flex shrink-0 items-center gap-2">
                                        <button onClick={() => startEdit(program)} className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 rounded hover:bg-blue-50 transition">
                                            수정
                                        </button>
                                        {deletingId === program.id ? (
                                            <span className="flex items-center gap-1.5">
                                                <button onClick={() => handleDelete(program.id)} disabled={deletePending} className="text-sm text-red-600 hover:text-red-800 font-bold px-2 py-1">확인</button>
                                                <span className="text-gray-300">/</span>
                                                <button onClick={() => setDeletingId(null)} className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1">취소</button>
                                            </span>
                                        ) : (
                                            <button onClick={() => setDeletingId(program.id)} className="text-sm text-red-500 hover:text-red-700 font-medium px-3 py-1.5 rounded hover:bg-red-50 transition">
                                                삭제
                                            </button>
                                        )}
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
