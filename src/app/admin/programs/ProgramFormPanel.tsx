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

const INPUT = "w-full border border-[var(--doc-rule)]  rounded-[3px] px-3 py-2 text-sm  focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime focus:border-[var(--doc-accent)]  bg-[var(--doc-grid-head)] focus:bg-[var(--doc-surface)]  ";

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
    runsShuttle?: boolean;
}

interface ProgramForm {
    name: string;
    targetAge: string;
    description: string;
    days: string[];
    priceWeek1: string;
    priceWeek2: string;
    priceWeek3: string;
    priceDaily: string;
    runsShuttle: boolean;
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
        days: [],
        priceWeek1: "",
        priceWeek2: "",
        priceWeek3: "",
        priceDaily: "",
        runsShuttle: true,
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
        days: savedDays,
        priceWeek1: p.priceWeek1 != null ? String(p.priceWeek1) : "",
        priceWeek2: p.priceWeek2 != null ? String(p.priceWeek2) : "",
        priceWeek3: p.priceWeek3 != null ? String(p.priceWeek3) : "",
        priceDaily: p.priceDaily != null ? String(p.priceDaily) : "",
        runsShuttle: p.runsShuttle !== false, // 미지정(기존 데이터)은 운행으로 간주
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
    // 대표 가격(price)은 주1/2/3회·매일반 중 먼저 입력된 값을 쓴다. 폼에 별도 입력칸은 없다.
    const fallbackPrice = priceWeek1 ?? priceWeek2 ?? priceWeek3 ?? priceDaily ?? 0;
    const weekend = isWeekendOnly(form.days);
    // 주말 전용은 예전처럼 셔틀 미운행을 강제하고, 그 외에는 토글(runsShuttle)로 결정한다.
    const runsShuttle = form.runsShuttle && !weekend;

    let shuttleFeeOverride: number | null;
    if (!runsShuttle) {
        // 셔틀 미운행 → 셔틀비 0 (부과 안 함). 주말/토글 OFF 공통 처리.
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
        runsShuttle,
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
                        className={`w-9 h-9 rounded-[3px] text-sm font-bold transition border-2 ${
 active
 ? isWknd
 ? "bg-[var(--doc-grid-head)] text-white border-[var(--doc-warn)]"
 : "bg-[var(--doc-ink)] text-white border-brand-navy-900"
 : "bg-[var(--doc-surface)] text-[var(--doc-ink-2)] border-[var(--doc-rule)] hover:border-[var(--doc-rule)]"
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
    // 셔틀 운행 여부: 주말 전용은 강제 미운행, 그 외에는 토글로 결정
    const shuttleOn = form.runsShuttle && !weekend;
    const hasAnyPrice = form.priceWeek1 || form.priceWeek2 || form.priceWeek3 || form.priceDaily;

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">프로그램명 *</label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={(e) => p({ name: e.target.value })}
                        placeholder="예: 정규 클래스 (취미/기초)"
                        className={INPUT}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">대상 연령</label>
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
                <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-2">
                    수업 요일
                </label>
                <DaySelector selected={form.days} onChange={(days) => p({ days })} />
                {weekend && (
                    <p className="mt-2 text-xs text-[var(--doc-warn)] font-medium">
                        🚌 주말 수업 — 셔틀버스 운행 없음
                    </p>
                )}
            </div>

            <div>
                <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-2">
                    수강료 (수업 빈도별)
                    <span className="text-[var(--doc-ink-3)] font-normal ml-2 text-xs">(해당하는 빈도에만 입력)</span>
                </label>
                <div className="overflow-x-auto rounded-[3px] border border-[var(--doc-rule)]">
                    <table className="w-full min-w-[560px] text-sm">
                        <thead className="bg-[var(--doc-grid-head)] border-b border-[var(--doc-rule)]">
                            <tr>
                                <th className="px-4 py-2.5 text-left font-semibold text-[var(--doc-ink-2)] w-28">수업 빈도</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-[var(--doc-ink-2)]">월 수강료</th>
                                {shuttleOn && (
                                    <th className="px-4 py-2.5 text-left font-semibold text-[var(--doc-ink-2)] w-36">셔틀비 (자동)</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--doc-rule)]">
                            {FREQ_TIERS.map((tier) => {
                                const val = form[tier.key];
                                return (
                                    <tr key={tier.key} className={val ? "bg-[var(--doc-grid-head)]/40" : ""}>
                                        <td className="px-4 py-2.5">
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-[3px] ${val ? "bg-[var(--doc-ink)] text-white" : "bg-[var(--doc-grid-head)] text-[var(--doc-ink-2)] "}`}>
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
                                                    className="w-full border border-[var(--doc-rule)] rounded-[3px] px-3 py-1.5 text-sm pr-7 bg-[var(--doc-grid-head)] focus:bg-[var(--doc-surface)] focus: focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime focus:border-[var(--doc-accent)] placeholder:text-[var(--doc-ink-3)]"
                                                />
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--doc-ink-3)]">원</span>
                                            </div>
                                            {val && !isNaN(Number(val)) && (
                                                <p className="text-[11px] text-[var(--doc-ink-2)] mt-0.5 pl-1">{Number(val).toLocaleString()}원</p>
                                            )}
                                        </td>
                                        {shuttleOn && (
                                            <td className="px-4 py-2.5">
                                                {form.shuttleFeeMode === "auto" ? (
                                                    <span className="text-xs text-[var(--doc-ink-2)] font-medium">
                                                        {tier.autoShuttle.toLocaleString()}원
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-[var(--doc-ink-3)]">-</span>
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

            {/* 셔틀 운행 여부 — 셔틀을 운행하지 않는 반도 있으므로 프로그램마다 직접 결정 */}
            <div>
                <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-2">
                    셔틀버스
                </label>
                <div className="border border-[var(--doc-rule)] rounded-[3px] p-4 bg-[var(--doc-grid-head)]">
                    <label className={`flex items-center justify-between gap-3 ${weekend ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
                        <span className="text-sm text-[var(--doc-ink-2)]">
                            <strong>셔틀 운행</strong>
                            {/* 주말이라 토글이 잠기는 경우에만 이유를 안내한다 */}
                            {weekend && (
                                <span className="text-[var(--doc-ink-3)] ml-2 text-xs">
                                    주말 수업은 셔틀을 운행하지 않습니다
                                </span>
                            )}
                        </span>
                        <span className="relative inline-flex shrink-0">
                            <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={shuttleOn}
                                disabled={weekend}
                                onChange={(e) => p({ runsShuttle: e.target.checked })}
                            />
                            <span className="h-6 w-11 rounded-[3px] bg-[var(--doc-grid-head)] peer-checked:bg-[var(--doc-accent)] dark:peer-checked:bg-brand-neon-lime transition-colors" />
                            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-[3px] bg-[var(--doc-surface)] transition-transform peer-checked:translate-x-5" />
                        </span>
                    </label>
                    {!shuttleOn && (
                        <p className="mt-3 text-xs font-medium text-[var(--doc-ink-2)]">
                            🚫 셔틀 미운행 — 이 프로그램은 셔틀비가 부과되지 않고, 셔틀 노선에도 포함되지 않습니다.
                        </p>
                    )}
                </div>
            </div>

            {shuttleOn && (
                <div>
                    <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-2">
                        셔틀비 설정
                    </label>
                    <div className="border border-[var(--doc-rule)] rounded-[3px] p-4 bg-[var(--doc-grid-head)] space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name={`shuttle-mode-${form.name}`}
                                checked={form.shuttleFeeMode === "auto"}
                                onChange={() => p({ shuttleFeeMode: "auto" })}
                                className="text-[var(--doc-accent)]"
                            />
                            <span className="text-sm text-[var(--doc-ink-2)]">
                                <strong>자동 계산</strong>
                                <span className="text-[var(--doc-ink-3)] ml-1">(주1회 10,000원 / 주2회 15,000원 / 주3회이상 20,000원)</span>
                            </span>
                        </label>
                        <label className="flex items-start gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name={`shuttle-mode-${form.name}`}
                                checked={form.shuttleFeeMode === "manual"}
                                onChange={() => p({ shuttleFeeMode: "manual" })}
                                className="text-[var(--doc-accent)] mt-1"
                            />
                            <div className="flex-1">
                                <span className="text-sm text-[var(--doc-ink-2)] font-medium">직접 입력</span>
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
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--doc-ink-3)]">원</span>
                                    </div>
                                )}
                            </div>
                        </label>
                    </div>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">프로그램 설명</label>
                <textarea
                    value={form.description}
                    onChange={(e) => p({ description: e.target.value })}
                    rows={2}
                    placeholder="기초 체력과 기본기를 다지는 클래스입니다."
                    className={INPUT}
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-[var(--doc-ink-2)] mb-1">프로그램 이미지 URL</label>
                <input
                    type="url"
                    value={form.imageUrl}
                    onChange={(e) => p({ imageUrl: e.target.value })}
                    placeholder="https://..."
                    className={INPUT + " font-mono text-xs"}
                />
            </div>

            <div className="flex justify-end gap-2 pt-2">
                {onCancel && (
                    <button type="button" onClick={onCancel}
                        className="border border-[var(--doc-rule)] text-[var(--doc-ink-2)] text-sm font-medium px-4 py-2 rounded-[3px] hover:bg-[var(--doc-grid-head)] transition">
                        취소
                    </button>
                )}
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={pending || !form.name.trim() || !hasAnyPrice}
                    className="bg-[var(--doc-ink)] text-white text-sm font-bold px-5 py-2 rounded-[3px] hover:bg-[var(--doc-grid-head)] transition disabled:opacity-40"
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
