"use client";

import { useEffect, useState, useTransition } from "react";
import { createProgram, updateProgram } from "@/app/actions/admin";

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

const INPUT = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:text-white focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime focus:border-brand-orange-500 dark:border-brand-neon-lime bg-gray-50 focus:bg-white dark:focus:bg-gray-700 dark:bg-gray-800";

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
    imageUrl: string | null;
}

interface ProgramForm {
    name: string;
    targetAge: string;
    description: string;
    price: string;
    days: string[];
    priceWeek1: string;
    priceWeek2: string;
    priceWeek3: string;
    priceDaily: string;
    shuttleFeeMode: "auto" | "manual";
    shuttleFeeManual: string;
    imageUrl: string;
}

function isWeekendOnly(days: string[]): boolean {
    if (days.length === 0) return false;
    return days.every((d) => WEEKEND.has(d));
}

function emptyForm(): ProgramForm {
    return {
        name: "",
        targetAge: "",
        description: "",
        price: "",
        days: [],
        priceWeek1: "",
        priceWeek2: "",
        priceWeek3: "",
        priceDaily: "",
        shuttleFeeMode: "auto",
        shuttleFeeManual: "",
        imageUrl: "",
    };
}

function programToForm(p: Program): ProgramForm {
    const savedDays = p.days ? p.days.split(",").filter(Boolean) : [];
    let shuttleFeeMode: "auto" | "manual" = "auto";
    let shuttleFeeManual = "";

    if (p.shuttleFeeOverride !== null && p.shuttleFeeOverride !== undefined && p.shuttleFeeOverride > 0) {
        shuttleFeeMode = "manual";
        shuttleFeeManual = String(p.shuttleFeeOverride);
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
        imageUrl: p.imageUrl ?? "",
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
        shuttleFeeOverride = null;
    }

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
        imageUrl: form.imageUrl.trim() || null,
    };
}

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
                                : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 hover:border-gray-400"
                        }`}
                    >
                        {d.label}
                    </button>
                );
            })}
        </div>
    );
}

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">프로그램명 *</label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={(e) => p({ name: e.target.value })}
                        placeholder="예: 정규 클래스 (취미/기초)"
                        className={INPUT}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">대상 연령</label>
                    <input
                        type="text"
                        value={form.targetAge}
                        onChange={(e) => p({ targetAge: e.target.value })}
                        placeholder="예: 초등 / 중등"
                        className={INPUT}
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
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

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    수강료 (수업 빈도별)
                    <span className="text-gray-400 font-normal ml-2 text-xs">(해당하는 빈도에만 입력)</span>
                </label>
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                    <table className="w-full min-w-[560px] text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="px-4 py-2.5 text-left font-semibold text-gray-700 dark:text-gray-200 w-28">수업 빈도</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-gray-700 dark:text-gray-200">월 수강료</th>
                                {!weekend && (
                                    <th className="px-4 py-2.5 text-left font-semibold text-gray-700 dark:text-gray-200 w-36">셔틀비 (자동)</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {FREQ_TIERS.map((tier) => {
                                const val = form[tier.key];
                                return (
                                    <tr key={tier.key} className={val ? "bg-blue-50/40" : ""}>
                                        <td className="px-4 py-2.5">
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${val ? "bg-brand-navy-900 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"}`}>
                                                {tier.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="relative max-w-[180px]">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={val}
                                                    onChange={(e) => p({ [tier.key]: e.target.value } as Partial<ProgramForm>)}
                                                    placeholder="미제공"
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm pr-7 bg-gray-50 focus:bg-white dark:focus:bg-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime focus:border-brand-orange-500 dark:border-brand-neon-lime placeholder:text-gray-300"
                                                />
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                                            </div>
                                            {val && !isNaN(Number(val)) && (
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 pl-1">{Number(val).toLocaleString()}원</p>
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

            {!weekend && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        셔틀비 설정
                    </label>
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-900 space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name={`shuttle-mode-${form.name}`}
                                checked={form.shuttleFeeMode === "auto"}
                                onChange={() => p({ shuttleFeeMode: "auto" })}
                                className="text-brand-orange-500 dark:text-brand-neon-lime"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-200">
                                <strong>자동 계산</strong>
                                <span className="text-gray-400 ml-1">(주1회 10,000원 / 주2회 15,000원 / 주3회이상 20,000원)</span>
                            </span>
                        </label>
                        <label className="flex items-start gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name={`shuttle-mode-${form.name}`}
                                checked={form.shuttleFeeMode === "manual"}
                                onChange={() => p({ shuttleFeeMode: "manual" })}
                                className="text-brand-orange-500 dark:text-brand-neon-lime mt-1"
                            />
                            <div className="flex-1">
                                <span className="text-sm text-gray-700 dark:text-gray-200 font-medium">직접 입력</span>
                                {form.shuttleFeeMode === "manual" && (
                                    <div className="relative max-w-[200px] mt-2">
                                        <input
                                            type="number"
                                            min={0}
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

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">프로그램 설명</label>
                <textarea
                    value={form.description}
                    onChange={(e) => p({ description: e.target.value })}
                    rows={2}
                    placeholder="기초 체력과 기본기를 다지는 클래스입니다."
                    className={INPUT}
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">프로그램 이미지 URL</label>
                <input
                    type="url"
                    value={form.imageUrl}
                    onChange={(e) => p({ imageUrl: e.target.value })}
                    placeholder="https://... (Supabase Storage 또는 외부 이미지)"
                    className={INPUT + " font-mono text-xs"}
                />
            </div>

            <div className="flex justify-end gap-2 pt-2">
                {onCancel && (
                    <button type="button" onClick={onCancel}
                        className="border border-gray-300 text-gray-600 dark:text-gray-300 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition">
                        취소
                    </button>
                )}
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={pending || !form.name.trim() || !hasAnyPrice}
                    className="bg-brand-navy-900 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-40 shadow-sm"
                >
                    {pending ? "저장 중..." : submitLabel}
                </button>
            </div>
        </div>
    );
}

export default function ProgramFormPanel({
    mode,
    program,
    onCancel,
    onSaved,
    onPendingChange,
}: {
    mode: "add" | "edit";
    program?: Program;
    onCancel: () => void;
    onSaved: () => void;
    onPendingChange?: (pending: boolean) => void;
}) {
    const [form, setForm] = useState<ProgramForm>(() => mode === "edit" && program ? programToForm(program) : emptyForm());
    const [pending, startTransition] = useTransition();

    useEffect(() => {
        setForm(mode === "edit" && program ? programToForm(program) : emptyForm());
    }, [mode, program?.id, program]);

    useEffect(() => {
        onPendingChange?.(pending);
        return () => onPendingChange?.(false);
    }, [pending, onPendingChange]);

    function handleSubmit() {
        if (!form.name.trim()) return;

        startTransition(async () => {
            try {
                if (mode === "edit") {
                    if (!program) return;
                    await updateProgram(program.id, formToData(form));
                } else {
                    await createProgram(formToData(form));
                }
                onSaved();
            } catch (error) {
                alert(error instanceof Error ? error.message : mode === "edit" ? "수정 실패" : "저장 실패");
            }
        });
    }

    return (
        <ProgramFormFields
            form={form}
            onChange={setForm}
            onSubmit={handleSubmit}
            onCancel={onCancel}
            submitLabel={mode === "edit" ? "저장" : "저장하기"}
            pending={pending}
        />
    );
}
