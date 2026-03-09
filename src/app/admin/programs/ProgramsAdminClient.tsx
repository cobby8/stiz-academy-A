"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProgram, updateProgram, deleteProgram } from "@/app/actions/admin";

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_OPTIONS = [
    { key: "Mon", label: "월" },
    { key: "Tue", label: "화" },
    { key: "Wed", label: "수" },
    { key: "Thu", label: "목" },
    { key: "Fri", label: "금" },
    { key: "Sat", label: "토" },
    { key: "Sun", label: "일" },
];

const WEEKEND = new Set(["Sat", "Sun"]);

const FREQ_TIERS = [
    { key: "priceWeek1" as const, label: "주 1회", autoShuttle: 10000 },
    { key: "priceWeek2" as const, label: "주 2회", autoShuttle: 15000 },
    { key: "priceWeek3" as const, label: "주 3회", autoShuttle: 20000 },
    { key: "priceDaily" as const, label: "매일반", autoShuttle: 20000 },
];

function isWeekendOnly(days: string[]): boolean {
    if (days.length === 0) return false;
    return days.every((d) => WEEKEND.has(d));
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Program {
    id: string;
    name: string;
    targetAge: string | null;
    weeklyFrequency: string | null;
    frequency: string | null;
    description: string | null;
    price: number;
    days: string | null;
    priceWeek1: number | null;
    priceWeek2: number | null;
    priceWeek3: number | null;
    priceDaily: number | null;
    shuttleFeeOverride: number | null;
}

interface ProgramForm {
    name: string;
    targetAge: string;
    description: string;
    price: string;           // legacy fallback price
    days: string[];
    priceWeek1: string;
    priceWeek2: string;
    priceWeek3: string;
    priceDaily: string;
    shuttleFeeMode: "auto" | "manual";
    shuttleFeeManual: string;
}

function emptyForm(): ProgramForm {
    return {
        name: "", targetAge: "", description: "", price: "",
        days: [],
        priceWeek1: "", priceWeek2: "", priceWeek3: "", priceDaily: "",
        shuttleFeeMode: "auto", shuttleFeeManual: "",
    };
}

function programToForm(p: Program): ProgramForm {
    const savedDays = p.days ? p.days.split(",").filter(Boolean) : [];
    let shuttleFeeMode: "auto" | "manual" = "auto";
    let shuttleFeeManual = "";
    if (p.shuttleFeeOverride !== null && p.shuttleFeeOverride !== undefined) {
        if (p.shuttleFeeOverride > 0) {
            shuttleFeeMode = "manual";
            shuttleFeeManual = String(p.shuttleFeeOverride);
        }
        // 0 = weekend/no shuttle → derived from days, keep mode=auto
    }
    return {
        name: p.name,
        targetAge: p.targetAge ?? "",
        description: p.description ?? "",
        price: String(p.price || ""),
        days: savedDays,
        priceWeek1: p.priceWeek1 != null ? String(p.priceWeek1) : "",
        priceWeek2: p.priceWeek2 != null ? String(p.priceWeek2) : "",
        priceWeek3: p.priceWeek3 != null ? String(p.priceWeek3) : "",
        priceDaily: p.priceDaily != null ? String(p.priceDaily) : "",
        shuttleFeeMode,
        shuttleFeeManual,
    };
}

function formToData(form: ProgramForm) {
    const priceWeek1 = form.priceWeek1 ? parseInt(form.priceWeek1) : null;
    const priceWeek2 = form.priceWeek2 ? parseInt(form.priceWeek2) : null;
    const priceWeek3 = form.priceWeek3 ? parseInt(form.priceWeek3) : null;
    const priceDaily = form.priceDaily ? parseInt(form.priceDaily) : null;
    const fallbackPrice = priceWeek1 ?? priceWeek2 ?? priceWeek3 ?? priceDaily ?? parseInt(form.price) ?? 0;

    const weekend = isWeekendOnly(form.days);
    let shuttleFeeOverride: number | null;
    if (weekend) {
        shuttleFeeOverride = 0;
    } else if (form.shuttleFeeMode === "manual" && form.shuttleFeeManual) {
        shuttleFeeOverride = parseInt(form.shuttleFeeManual) || null;
    } else {
        shuttleFeeOverride = null; // auto
    }

    // Derive primary weeklyFrequency from lowest filled tier
    const weeklyFrequency =
        priceWeek1 != null ? "주1회" :
        priceWeek2 != null ? "주2회" :
        priceWeek3 != null ? "주3회" :
        priceDaily != null ? "매일반" : undefined;

    return {
        name: form.name.trim(),
        targetAge: form.targetAge.trim() || undefined,
        weeklyFrequency,
        description: form.description.trim() || undefined,
        price: fallbackPrice,
        days: form.days.length > 0 ? form.days.join(",") : null,
        priceWeek1,
        priceWeek2,
        priceWeek3,
        priceDaily,
        shuttleFeeOverride,
    };
}

// ── Helper to display shuttle fee for a given frequency + override ─────────────

function displayShuttleFee(
    shuttleFeeOverride: number | null | undefined,
    freqKey: typeof FREQ_TIERS[number]["key"],
    weekend: boolean,
): string | null {
    if (weekend) return null; // no service
    if (shuttleFeeOverride === 0) return null; // explicitly disabled
    if (shuttleFeeOverride != null && shuttleFeeOverride > 0)
        return shuttleFeeOverride.toLocaleString() + "원";
    // auto
    const tier = FREQ_TIERS.find((t) => t.key === freqKey);
    return tier ? tier.autoShuttle.toLocaleString() + "원" : null;
}

// ── CSS shortcuts ─────────────────────────────────────────────────────────────

const INPUT = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-orange-500 focus:border-brand-orange-500 bg-gray-50 focus:bg-white";

// ── Day Badge Selector ────────────────────────────────────────────────────────

function DaySelector({ selected, onChange }: { selected: string[]; onChange: (d: string[]) => void }) {
    const toggle = (key: string) => {
        onChange(selected.includes(key) ? selected.filter((d) => d !== key) : [...selected, key]);
    };
    return (
        <div className="flex flex-wrap gap-2">
            {DAY_OPTIONS.map((d) => {
                const active = selected.includes(d.key);
                const isWknd = WEEKEND.has(d.key);
                return (
                    <button
                        key={d.key}
                        type="button"
                        onClick={() => toggle(d.key)}
                        className={`w-9 h-9 rounded-full text-sm font-bold transition border-2 ${
                            active
                                ? isWknd
                                    ? "bg-orange-500 text-white border-orange-500"
                                    : "bg-brand-navy-900 text-white border-brand-navy-900"
                                : "bg-white text-gray-500 border-gray-300 hover:border-gray-400"
                        }`}
                    >
                        {d.label}
                    </button>
                );
            })}
        </div>
    );
}

// ── Program Form Fields ───────────────────────────────────────────────────────

function ProgramFormFields({
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
    const weekend = isWeekendOnly(form.days);
    const hasAnyPrice = form.priceWeek1 || form.priceWeek2 || form.priceWeek3 || form.priceDaily;

    return (
        <div className="space-y-5">
            {/* Row 1: Name + Target Age */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">프로그램명 *</label>
                    <input
                        type="text" value={form.name}
                        onChange={(e) => p({ name: e.target.value })}
                        placeholder="예: 정규 클래스 (취미/기초)"
                        className={INPUT}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">대상 연령</label>
                    <input
                        type="text" value={form.targetAge}
                        onChange={(e) => p({ targetAge: e.target.value })}
                        placeholder="예: 초등 / 중등"
                        className={INPUT}
                    />
                </div>
            </div>

            {/* Row 2: Day Selector */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    수업 요일
                    <span className="text-gray-400 font-normal ml-2 text-xs">(해당 요일 선택)</span>
                </label>
                <DaySelector selected={form.days} onChange={(days) => p({ days })} />
                {weekend && (
                    <p className="mt-2 text-xs text-orange-600 font-medium">
                        🚌 주말 수업 — 셔틀버스 운행 없음
                    </p>
                )}
            </div>

            {/* Row 3: Per-frequency price table */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    수강료 (수업 빈도별)
                    <span className="text-gray-400 font-normal ml-2 text-xs">(해당하는 빈도에만 입력)</span>
                </label>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-2.5 text-left font-semibold text-gray-700 w-28">수업 빈도</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-gray-700">월 수강료</th>
                                {!weekend && (
                                    <th className="px-4 py-2.5 text-left font-semibold text-gray-700 w-36">셔틀비 (자동)</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {FREQ_TIERS.map((tier) => {
                                const val = form[tier.key];
                                return (
                                    <tr key={tier.key} className={val ? "bg-blue-50/40" : ""}>
                                        <td className="px-4 py-2.5">
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${val ? "bg-brand-navy-900 text-white" : "bg-gray-100 text-gray-500"}`}>
                                                {tier.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="relative max-w-[180px]">
                                                <input
                                                    type="number" min={0}
                                                    value={val}
                                                    onChange={(e) => p({ [tier.key]: e.target.value } as any)}
                                                    placeholder="미제공"
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm pr-7 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-orange-500 focus:border-brand-orange-500 placeholder:text-gray-300"
                                                />
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                                            </div>
                                            {val && !isNaN(Number(val)) && (
                                                <p className="text-[11px] text-gray-500 mt-0.5 pl-1">{Number(val).toLocaleString()}원</p>
                                            )}
                                        </td>
                                        {!weekend && (
                                            <td className="px-4 py-2.5">
                                                {form.shuttleFeeMode === "auto" ? (
                                                    <span className="text-xs text-blue-600 font-medium">
                                                        {tier.autoShuttle.toLocaleString()}원
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400">-</span>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Row 4: Shuttle fee control */}
            {!weekend && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        셔틀비 설정
                    </label>
                    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio" name={`shuttle-mode-${form.name}`}
                                checked={form.shuttleFeeMode === "auto"}
                                onChange={() => p({ shuttleFeeMode: "auto" })}
                                className="text-brand-orange-500"
                            />
                            <span className="text-sm text-gray-700">
                                <strong>자동 계산</strong>
                                <span className="text-gray-400 ml-1">(주1회 10,000원 / 주2회 15,000원 / 주3회이상 20,000원)</span>
                            </span>
                        </label>
                        <label className="flex items-start gap-2 cursor-pointer">
                            <input
                                type="radio" name={`shuttle-mode-${form.name}`}
                                checked={form.shuttleFeeMode === "manual"}
                                onChange={() => p({ shuttleFeeMode: "manual" })}
                                className="text-brand-orange-500 mt-1"
                            />
                            <div className="flex-1">
                                <span className="text-sm text-gray-700 font-medium">직접 입력</span>
                                {form.shuttleFeeMode === "manual" && (
                                    <div className="relative max-w-[200px] mt-2">
                                        <input
                                            type="number" min={0}
                                            value={form.shuttleFeeManual}
                                            onChange={(e) => p({ shuttleFeeManual: e.target.value })}
                                            placeholder="예: 12000"
                                            className={INPUT + " pr-7"}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                                    </div>
                                )}
                            </div>
                        </label>
                    </div>
                </div>
            )}

            {/* Row 5: Description */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">프로그램 설명</label>
                <textarea
                    value={form.description}
                    onChange={(e) => p({ description: e.target.value })}
                    rows={2}
                    placeholder="기초 체력과 기본기를 다지는 클래스입니다."
                    className={INPUT}
                />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
                {onCancel && (
                    <button type="button" onClick={onCancel}
                        className="border border-gray-300 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition">
                        취소
                    </button>
                )}
                <button
                    type="button" onClick={onSubmit}
                    disabled={pending || !form.name.trim() || !hasAnyPrice}
                    className="bg-brand-navy-900 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-40 shadow-sm"
                >
                    {pending ? "저장 중..." : submitLabel}
                </button>
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProgramsAdminClient({ programs: initialPrograms }: { programs: Program[] }) {
    const router = useRouter();
    const [addForm, setAddForm] = useState<ProgramForm>(emptyForm);
    const [editId, setEditId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<ProgramForm>(emptyForm);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [addPending, startAddTransition] = useTransition();
    const [editPending, startEditTransition] = useTransition();
    const [deletePending, startDeleteTransition] = useTransition();

    function handleAdd() {
        if (!addForm.name.trim()) return;
        startAddTransition(async () => {
            try {
                await createProgram(formToData(addForm));
                setAddForm(emptyForm());
                router.refresh();
            } catch (e: any) {
                alert(e.message || "저장 실패");
            }
        });
    }

    function handleUpdate() {
        if (!editForm.name.trim() || !editId) return;
        startEditTransition(async () => {
            try {
                await updateProgram(editId, formToData(editForm));
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

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">프로그램(커리큘럼) 관리</h1>
                <p className="text-gray-500">학원에서 운영하는 교육 프로그램을 등록하고 관리합니다.</p>
            </div>

            {/* Shuttle fee reference */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-bold text-blue-800 mb-2">🚌 셔틀버스 자동 요금 기준 (평일 수업)</p>
                <div className="flex flex-wrap gap-3">
                    {[
                        { freq: "주1회", fee: "10,000원" },
                        { freq: "주2회", fee: "15,000원" },
                        { freq: "주3회 / 매일반", fee: "20,000원" },
                        { freq: "주말 수업", fee: "셔틀 운행 없음" },
                    ].map((s) => (
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
                <ProgramFormFields
                    form={addForm} onChange={setAddForm}
                    onSubmit={handleAdd} submitLabel="저장하기" pending={addPending}
                />
            </div>

            {/* Program List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <h2 className="text-lg font-bold text-gray-900 p-6 border-b border-gray-100 bg-gray-50/50">
                    등록된 프로그램 목록
                </h2>
                <ul className="divide-y divide-gray-100">
                    {initialPrograms.length === 0 && (
                        <li className="p-8 text-center text-gray-500">등록된 프로그램이 없습니다.</li>
                    )}
                    {initialPrograms.map((program, i) => (
                        <li key={program.id} className="p-6 hover:bg-gray-50/50 transition">
                            {editId === program.id ? (
                                <div>
                                    <p className="text-sm font-bold text-blue-700 mb-3">수정 중...</p>
                                    <ProgramFormFields
                                        form={editForm} onChange={setEditForm}
                                        onSubmit={handleUpdate}
                                        onCancel={() => setEditId(null)}
                                        submitLabel="저장" pending={editPending}
                                    />
                                </div>
                            ) : (
                                <ProgramCardInline
                                    program={program} index={i}
                                    onEdit={() => { setEditId(program.id); setEditForm(programToForm(program)); }}
                                    onDelete={() => handleDelete(program.id)}
                                    isDeleting={deletingId === program.id}
                                    deletePending={deletePending}
                                    onSetDeleting={() => setDeletingId(program.id)}
                                    onCancelDelete={() => setDeletingId(null)}
                                />
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

// ── Inline card (no onClick hell) ─────────────────────────────────────────────

function ProgramCardInline({
    program, index, onEdit, onDelete, isDeleting, deletePending, onSetDeleting, onCancelDelete,
}: {
    program: Program;
    index: number;
    onEdit: () => void;
    onDelete: () => void;
    isDeleting: boolean;
    deletePending: boolean;
    onSetDeleting: () => void;
    onCancelDelete: () => void;
}) {
    const days = program.days ? program.days.split(",").filter(Boolean) : [];
    const weekend = isWeekendOnly(days);
    const tiers = FREQ_TIERS.filter((t) => program[t.key] != null);
    const freq = program.weeklyFrequency || program.frequency;

    return (
        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
            <div className="flex-1 min-w-0">
                {/* Title row */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="bg-brand-navy-900 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                        {index + 1}
                    </span>
                    <h3 className="font-bold text-gray-900 text-lg">{program.name}</h3>
                    {/* Frequency badges */}
                    {tiers.length === 0 && freq && (
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full">{freq}</span>
                    )}
                    {tiers.map((t) => (
                        <span key={t.key} className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full">{t.label}</span>
                    ))}
                    {program.targetAge && (
                        <span className="bg-orange-50 text-orange-600 text-xs font-bold px-2.5 py-0.5 rounded-full border border-orange-200">
                            {program.targetAge}
                        </span>
                    )}
                    {/* Day badges */}
                    {days.length > 0 && days.map((d) => (
                        <span key={d} className={`text-xs font-bold px-2 py-0.5 rounded-full ${WEEKEND.has(d) ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>
                            {DAY_OPTIONS.find((o) => o.key === d)?.label || d}
                        </span>
                    ))}
                </div>

                {/* Pricing */}
                {tiers.length > 0 ? (
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm mt-1">
                        {tiers.map((t) => {
                            const fee = displayShuttleFee(program.shuttleFeeOverride, t.key, weekend);
                            return (
                                <span key={t.key} className="text-gray-600">
                                    <span className="text-gray-400 text-xs">{t.label}</span>{" "}
                                    <strong className="text-brand-navy-900">{Number(program[t.key]).toLocaleString()}원</strong>
                                    {fee && (
                                        <span className="text-blue-500 ml-1 text-xs">+ 셔틀 {fee}</span>
                                    )}
                                </span>
                            );
                        })}
                        {weekend && (
                            <span className="text-xs text-orange-600 font-medium">🚌 셔틀 운행 없음</span>
                        )}
                        {!weekend && program.shuttleFeeOverride === 0 && (
                            <span className="text-xs text-gray-400">셔틀 없음</span>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 mt-1">
                        <span>
                            <span className="text-gray-400">수강료</span>{" "}
                            <strong className="text-brand-navy-900">{program.price.toLocaleString()}원 / 월</strong>
                        </span>
                    </div>
                )}

                {program.description && (
                    <p className="text-sm text-gray-500 mt-2">{program.description}</p>
                )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
                <button onClick={onEdit}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 rounded hover:bg-blue-50 transition">
                    수정
                </button>
                {isDeleting ? (
                    <span className="flex items-center gap-1.5">
                        <button onClick={onDelete} disabled={deletePending}
                            className="text-sm text-red-600 hover:text-red-800 font-bold px-2 py-1">확인</button>
                        <span className="text-gray-300">/</span>
                        <button onClick={onCancelDelete}
                            className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1">취소</button>
                    </span>
                ) : (
                    <button onClick={onSetDeleting}
                        className="text-sm text-red-500 hover:text-red-700 font-medium px-3 py-1.5 rounded hover:bg-red-50 transition">
                        삭제
                    </button>
                )}
            </div>
        </div>
    );
}
