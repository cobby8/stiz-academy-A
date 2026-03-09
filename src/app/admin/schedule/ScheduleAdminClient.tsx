"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    upsertClassSlotOverride,
    createCustomSlot,
    updateCustomSlot,
    deleteCustomSlot,
} from "@/app/actions/schedule";
import type { SheetClassSlot } from "@/lib/googleSheetsSchedule";

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LABEL: Record<string, string> = {
    Mon: "월요일", Tue: "화요일", Wed: "수요일", Thu: "목요일",
    Fri: "금요일", Sat: "토요일", Sun: "일요일",
};
const DAY_COLOR: Record<string, string> = {
    Mon: "bg-blue-600", Tue: "bg-green-600", Wed: "bg-yellow-500",
    Thu: "bg-purple-600", Fri: "bg-red-500", Sat: "bg-brand-orange-500", Sun: "bg-gray-500",
};

interface Coach {
    id: string;
    name: string;
    role: string;
    imageUrl: string | null;
}

interface Override {
    slotKey: string;
    label: string | null;
    note: string | null;
    isHidden: boolean;
    capacity: number;
    coachId: string | null;
    startTimeOverride?: string | null;
    endTimeOverride?: string | null;
}

interface SlotState {
    label: string;
    note: string;
    isHidden: boolean;
    capacity: number;
    coachId: string;
    startTimeOverride: string;
    endTimeOverride: string;
    dirty: boolean;
    saved: boolean;
    error: string | null;
}

interface CustomSlot {
    id: string;
    dayKey: string;
    startTime: string;
    endTime: string;
    label: string;
    gradeRange: string | null;
    enrolled: number;
    capacity: number;
    note: string | null;
    isHidden: boolean;
    coachId: string | null;
    coach: Coach | null;
}

interface CustomSlotForm {
    dayKey: string;
    startTime: string;
    endTime: string;
    label: string;
    gradeRange: string;
    enrolled: number;
    capacity: number;
    note: string;
    isHidden: boolean;
    coachId: string;
}

function defaultCustomSlotForm(): CustomSlotForm {
    return { dayKey: "Mon", startTime: "14:00", endTime: "15:00", label: "", gradeRange: "", enrolled: 0, capacity: 12, note: "", isHidden: false, coachId: "" };
}

function buildInitialState(overrides: Override[]): Record<string, SlotState> {
    const map: Record<string, SlotState> = {};
    for (const o of overrides) {
        map[o.slotKey] = {
            label: o.label ?? "",
            note: o.note ?? "",
            isHidden: o.isHidden,
            capacity: o.capacity,
            coachId: o.coachId ?? "",
            startTimeOverride: o.startTimeOverride ?? "",
            endTimeOverride: o.endTimeOverride ?? "",
            dirty: false,
            saved: false,
            error: null,
        };
    }
    return map;
}

function defaultSlotState(): SlotState {
    return { label: "", note: "", isHidden: false, capacity: 12, coachId: "", startTimeOverride: "", endTimeOverride: "", dirty: false, saved: false, error: null };
}

const INPUT = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-orange-500 focus:border-brand-orange-500 bg-gray-50 focus:bg-white";
const TIME_INPUT = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-orange-500 focus:border-brand-orange-500 bg-gray-50 focus:bg-white";

export default function ScheduleAdminClient({
    slots,
    overrides,
    coaches,
    customSlots: initialCustomSlots,
    hasSheetUrl,
}: {
    slots: SheetClassSlot[];
    overrides: Override[];
    coaches: Coach[];
    customSlots: CustomSlot[];
    hasSheetUrl: boolean;
}) {
    const router = useRouter();
    const [stateMap, setStateMap] = useState<Record<string, SlotState>>(() => buildInitialState(overrides));
    const [pending, startTransition] = useTransition();

    // Custom slot state
    const [isAddingCustom, setIsAddingCustom] = useState(false);
    const [newCustomForm, setNewCustomForm] = useState<CustomSlotForm>(defaultCustomSlotForm);
    const [editingCustomId, setEditingCustomId] = useState<string | null>(null);
    const [editCustomForm, setEditCustomForm] = useState<CustomSlotForm>(defaultCustomSlotForm);
    const [customPending, startCustomTransition] = useTransition();
    const [deletingCustomId, setDeletingCustomId] = useState<string | null>(null);

    const coachMap = Object.fromEntries(coaches.map((c) => [c.id, c]));

    function getState(slotKey: string): SlotState {
        return stateMap[slotKey] ?? defaultSlotState();
    }

    function update(slotKey: string, patch: Partial<SlotState>) {
        setStateMap((prev) => ({
            ...prev,
            [slotKey]: { ...(prev[slotKey] ?? defaultSlotState()), ...patch, dirty: true, saved: false },
        }));
    }

    function save(slot: SheetClassSlot) {
        const s = getState(slot.slotKey);
        startTransition(async () => {
            try {
                await upsertClassSlotOverride(slot.slotKey, {
                    label: s.label || undefined,
                    note: s.note || undefined,
                    isHidden: s.isHidden,
                    capacity: s.capacity,
                    coachId: s.coachId || null,
                    startTimeOverride: s.startTimeOverride || null,
                    endTimeOverride: s.endTimeOverride || null,
                });
                setStateMap((prev) => ({
                    ...prev,
                    [slot.slotKey]: { ...s, dirty: false, saved: true, error: null },
                }));
            } catch {
                setStateMap((prev) => ({
                    ...prev,
                    [slot.slotKey]: { ...s, error: "저장 실패" },
                }));
            }
        });
    }

    function handleAddCustom() {
        if (!newCustomForm.label.trim()) return;
        startCustomTransition(async () => {
            try {
                await createCustomSlot({
                    dayKey: newCustomForm.dayKey,
                    startTime: newCustomForm.startTime,
                    endTime: newCustomForm.endTime,
                    label: newCustomForm.label.trim(),
                    gradeRange: newCustomForm.gradeRange.trim() || undefined,
                    enrolled: newCustomForm.enrolled,
                    capacity: newCustomForm.capacity,
                    note: newCustomForm.note.trim() || undefined,
                    isHidden: newCustomForm.isHidden,
                    coachId: newCustomForm.coachId || null,
                });
                setNewCustomForm(defaultCustomSlotForm());
                setIsAddingCustom(false);
                router.refresh();
            } catch (e: any) {
                alert(e.message || "생성 실패");
            }
        });
    }

    function startEditCustom(cs: CustomSlot) {
        setEditingCustomId(cs.id);
        setEditCustomForm({
            dayKey: cs.dayKey, startTime: cs.startTime, endTime: cs.endTime,
            label: cs.label, gradeRange: cs.gradeRange ?? "", enrolled: cs.enrolled,
            capacity: cs.capacity, note: cs.note ?? "", isHidden: cs.isHidden, coachId: cs.coachId ?? "",
        });
    }

    function handleUpdateCustom(id: string) {
        if (!editCustomForm.label.trim()) return;
        startCustomTransition(async () => {
            try {
                await updateCustomSlot(id, {
                    dayKey: editCustomForm.dayKey, startTime: editCustomForm.startTime,
                    endTime: editCustomForm.endTime, label: editCustomForm.label.trim(),
                    gradeRange: editCustomForm.gradeRange.trim() || null, enrolled: editCustomForm.enrolled,
                    capacity: editCustomForm.capacity, note: editCustomForm.note.trim() || null,
                    isHidden: editCustomForm.isHidden, coachId: editCustomForm.coachId || null,
                });
                setEditingCustomId(null);
                router.refresh();
            } catch (e: any) {
                alert(e.message || "수정 실패");
            }
        });
    }

    function handleDeleteCustom(id: string) {
        startCustomTransition(async () => {
            try {
                await deleteCustomSlot(id);
                setDeletingCustomId(null);
                router.refresh();
            } catch (e: any) {
                alert(e.message || "삭제 실패");
            }
        });
    }

    const byDay = DAY_ORDER.reduce<Record<string, SheetClassSlot[]>>((acc, d) => {
        acc[d] = slots.filter((s) => s.dayKey === d).sort((a, b) => a.period - b.period);
        return acc;
    }, {});
    const activeDays = DAY_ORDER.filter((d) => byDay[d].length > 0);

    return (
        <div className="space-y-8">
            {/* Page header with + button top-right */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">수업시간표 관리</h1>
                    <p className="text-gray-500 text-sm">
                        학년·인원은 구글시트에서 자동 동기화됩니다. 레이블·시간·메모·정원·코치는 직접 편집할 수 있습니다.
                    </p>
                </div>
                <button
                    onClick={() => { setNewCustomForm(defaultCustomSlotForm()); setIsAddingCustom(true); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }}
                    className="shrink-0 bg-white border border-gray-300 text-gray-800 text-sm font-bold px-4 py-2 rounded-xl hover:bg-gray-50 shadow-sm transition flex items-center gap-1.5"
                >
                    <span className="text-brand-orange-500">+</span> 수업 추가
                </button>
            </div>

            {!hasSheetUrl && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
                    <p className="font-bold mb-1">⚠ 구글시트 URL이 설정되지 않았습니다.</p>
                    <p>
                        <a href="/admin/settings" className="underline font-medium hover:text-amber-900">
                            학원 소개 관리 → 구글시트 시간표 연동
                        </a>
                        에서 URL을 먼저 입력해 주세요.
                    </p>
                </div>
            )}

            {hasSheetUrl && slots.length === 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center text-gray-500">
                    <p className="text-lg font-medium mb-1">시트에서 수업 데이터를 찾을 수 없습니다.</p>
                    <p className="text-sm">시트가 공개 설정인지, URL과 탭(gid)이 올바른지 확인해 주세요.</p>
                </div>
            )}

            {/* ── 구글시트 연동 수업 ── */}
            {activeDays.map((dayKey) => (
                <div key={dayKey} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className={`${DAY_COLOR[dayKey]} text-white px-5 py-3 flex items-center gap-3`}>
                        <span className="font-black text-lg">{DAY_LABEL[dayKey]}</span>
                        <span className="text-white/70 text-sm">{byDay[dayKey].length}개 수업</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {byDay[dayKey].map((slot) => {
                            const s = getState(slot.slotKey);
                            const assignedCoach = s.coachId ? coachMap[s.coachId] : null;
                            const displayStart = s.startTimeOverride || slot.startTime;
                            const displayEnd = s.endTimeOverride || slot.endTime;
                            return (
                                <div key={slot.slotKey} className="p-5">
                                    {/* Read-only info row */}
                                    <div className="flex flex-wrap items-center gap-2 mb-4">
                                        <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-full">
                                            {slot.period}교시
                                        </span>
                                        <span className="text-sm font-bold text-gray-800">
                                            {displayStart} ~ {displayEnd}
                                            {s.startTimeOverride && (
                                                <span className="ml-1 text-xs text-brand-orange-600 font-normal">(조정됨)</span>
                                            )}
                                        </span>
                                        {slot.gradeRange && (
                                            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-200">
                                                {slot.gradeRange}
                                            </span>
                                        )}
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${slot.enrolled >= s.capacity ? "bg-red-100 text-red-700" : "bg-green-50 text-green-700"}`}>
                                            {slot.enrolled}/{s.capacity}명{slot.enrolled >= s.capacity && " 마감"}
                                        </span>
                                        <span className="text-xs text-gray-400 font-mono">{slot.slotKey}</span>
                                        {assignedCoach && (
                                            <span className="flex items-center gap-1.5 text-xs text-gray-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full">
                                                {assignedCoach.imageUrl && <img src={assignedCoach.imageUrl} className="w-4 h-4 rounded-full object-cover" alt="" />}
                                                {assignedCoach.name}
                                            </span>
                                        )}
                                    </div>

                                    {/* Editable fields */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">
                                                표시 레이블<span className="font-normal text-gray-400 ml-1">(비워두면 "요일 n교시" 자동)</span>
                                            </label>
                                            <input type="text" value={s.label} onChange={(e) => update(slot.slotKey, { label: e.target.value })} placeholder={`${slot.dayLabel} ${slot.period}교시`} className={INPUT} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">정원<span className="font-normal text-gray-400 ml-1">(기본 12명)</span></label>
                                            <input type="number" min={1} max={50} value={s.capacity} onChange={(e) => update(slot.slotKey, { capacity: parseInt(e.target.value) || 12 })} className={INPUT} />
                                        </div>

                                        {/* Time overrides */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">
                                                시작 시간 조정<span className="font-normal text-gray-400 ml-1">(기본: {slot.startTime})</span>
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input type="time" value={s.startTimeOverride} onChange={(e) => update(slot.slotKey, { startTimeOverride: e.target.value })} className={TIME_INPUT + " flex-1"} />
                                                {s.startTimeOverride && <button type="button" onClick={() => update(slot.slotKey, { startTimeOverride: "" })} className="text-xs text-gray-400 hover:text-gray-600 shrink-0 px-1">✕</button>}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">
                                                종료 시간 조정<span className="font-normal text-gray-400 ml-1">(기본: {slot.endTime})</span>
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input type="time" value={s.endTimeOverride} onChange={(e) => update(slot.slotKey, { endTimeOverride: e.target.value })} className={TIME_INPUT + " flex-1"} />
                                                {s.endTimeOverride && <button type="button" onClick={() => update(slot.slotKey, { endTimeOverride: "" })} className="text-xs text-gray-400 hover:text-gray-600 shrink-0 px-1">✕</button>}
                                            </div>
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-gray-600 mb-1">
                                                메모 / 특이사항<span className="font-normal text-gray-400 ml-1">(공개 시간표에 표시됩니다)</span>
                                            </label>
                                            <input type="text" value={s.note} onChange={(e) => update(slot.slotKey, { note: e.target.value })} placeholder="예: 이번 주 보강 있음, 코치 변경 예정" className={INPUT} />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-gray-600 mb-1">
                                                담당 코치<span className="font-normal text-gray-400 ml-1">(공개 시간표 카드에 표시됩니다)</span>
                                            </label>
                                            <div className="flex items-center gap-3">
                                                <select value={s.coachId} onChange={(e) => update(slot.slotKey, { coachId: e.target.value })} className={INPUT + " flex-1"}>
                                                    <option value="">-- 코치 미배정 --</option>
                                                    {coaches.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.role})</option>)}
                                                </select>
                                                {s.coachId && coachMap[s.coachId]?.imageUrl && (
                                                    <img src={coachMap[s.coachId].imageUrl!} alt="" className="w-9 h-9 rounded-full object-cover border border-gray-200 shrink-0" />
                                                )}
                                            </div>
                                            {coaches.length === 0 && (
                                                <p className="text-xs text-amber-600 mt-1">등록된 코치가 없습니다. <a href="/admin/coaches" className="underline">코치 추가 →</a></p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input type="checkbox" checked={s.isHidden} onChange={(e) => update(slot.slotKey, { isHidden: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-brand-orange-500 focus:ring-brand-orange-500" />
                                            <span className="text-sm text-gray-600 font-medium">공개 시간표에서 숨기기</span>
                                        </label>
                                        <div className="flex items-center gap-3">
                                            {s.error && <span className="text-xs text-red-500">{s.error}</span>}
                                            {s.saved && !s.dirty && <span className="text-xs text-green-600 font-medium">✓ 저장됨</span>}
                                            <button
                                                onClick={() => save(slot)}
                                                disabled={pending || !s.dirty}
                                                className="bg-brand-navy-900 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                {pending ? "저장 중..." : "저장"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* ── 추가 수업 (직접 등록) ── */}
            {(initialCustomSlots.length > 0 || isAddingCustom) && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                        <span className="font-bold text-gray-700 text-sm">추가 수업</span>
                        <span className="text-xs text-gray-400">{initialCustomSlots.length}개</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {initialCustomSlots.map((cs) => (
                            <div key={cs.id} className="p-5">
                                {editingCustomId === cs.id ? (
                                    <div>
                                        <p className="text-sm font-bold text-gray-700 mb-3">수업 수정</p>
                                        <CustomSlotFormFields form={editCustomForm} onChange={setEditCustomForm} coaches={coaches} />
                                        <div className="flex gap-2 mt-4">
                                            <button onClick={() => handleUpdateCustom(cs.id)} disabled={customPending || !editCustomForm.label.trim()} className="bg-brand-navy-900 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-40">
                                                {customPending ? "저장 중..." : "저장"}
                                            </button>
                                            <button onClick={() => setEditingCustomId(null)} className="bg-white border border-gray-300 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition">
                                                취소
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`text-xs font-bold text-white px-2.5 py-1 rounded-full ${DAY_COLOR[cs.dayKey] || "bg-gray-500"}`}>
                                            {DAY_LABEL[cs.dayKey] || cs.dayKey}
                                        </span>
                                        <span className="text-sm font-bold text-gray-900">{cs.label}</span>
                                        <span className="text-sm text-gray-600">{cs.startTime} ~ {cs.endTime}</span>
                                        {cs.gradeRange && <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full border border-blue-200">{cs.gradeRange}</span>}
                                        <span className="text-xs text-gray-500">{cs.enrolled}/{cs.capacity}명</span>
                                        {cs.coach && (
                                            <span className="flex items-center gap-1 text-xs text-gray-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                                                {cs.coach.imageUrl && <img src={cs.coach.imageUrl} className="w-3.5 h-3.5 rounded-full object-cover" alt="" />}
                                                {cs.coach.name}
                                            </span>
                                        )}
                                        {cs.isHidden && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">숨김</span>}
                                        {cs.note && <span className="text-xs text-brand-orange-600">📌 {cs.note}</span>}
                                        <div className="ml-auto flex items-center gap-3">
                                            <button onClick={() => startEditCustom(cs)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">수정</button>
                                            {deletingCustomId === cs.id ? (
                                                <span className="flex items-center gap-1.5">
                                                    <button onClick={() => handleDeleteCustom(cs.id)} disabled={customPending} className="text-xs text-red-600 hover:text-red-800 font-bold">확인</button>
                                                    <span className="text-gray-300">/</span>
                                                    <button onClick={() => setDeletingCustomId(null)} className="text-xs text-gray-500 hover:text-gray-700">취소</button>
                                                </span>
                                            ) : (
                                                <button onClick={() => setDeletingCustomId(cs.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">삭제</button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Add custom slot form (appears at bottom when + button clicked) */}
            {isAddingCustom && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100">
                        <span className="font-bold text-gray-700 text-sm">새 수업 추가</span>
                    </div>
                    <div className="p-5">
                        <CustomSlotFormFields form={newCustomForm} onChange={setNewCustomForm} coaches={coaches} />
                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={handleAddCustom}
                                disabled={customPending || !newCustomForm.label.trim()}
                                className="bg-brand-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-5 py-2 rounded-lg transition disabled:opacity-40"
                            >
                                {customPending ? "저장 중..." : "저장"}
                            </button>
                            <button
                                onClick={() => setIsAddingCustom(false)}
                                className="bg-white border border-gray-300 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition"
                            >
                                취소
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function CustomSlotFormFields({
    form,
    onChange,
    coaches,
}: {
    form: CustomSlotForm;
    onChange: (f: CustomSlotForm) => void;
    coaches: Coach[];
}) {
    const DAY_OPTIONS = [
        { key: "Mon", label: "월요일" }, { key: "Tue", label: "화요일" },
        { key: "Wed", label: "수요일" }, { key: "Thu", label: "목요일" },
        { key: "Fri", label: "금요일" }, { key: "Sat", label: "토요일" },
        { key: "Sun", label: "일요일" },
    ];
    const p = (patch: Partial<CustomSlotForm>) => onChange({ ...form, ...patch });

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">요일 *</label>
                <select value={form.dayKey} onChange={(e) => p({ dayKey: e.target.value })} className={INPUT}>
                    {DAY_OPTIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">표시 레이블 *</label>
                <input type="text" value={form.label} onChange={(e) => p({ label: e.target.value })} placeholder="예: 성인반 A" className={INPUT} />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">시작 시간 *</label>
                <input type="time" value={form.startTime} onChange={(e) => p({ startTime: e.target.value })} className={TIME_INPUT + " w-full"} />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">종료 시간 *</label>
                <input type="time" value={form.endTime} onChange={(e) => p({ endTime: e.target.value })} className={TIME_INPUT + " w-full"} />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">학년 범위</label>
                <input type="text" value={form.gradeRange} onChange={(e) => p({ gradeRange: e.target.value })} placeholder="예: 초4~중1" className={INPUT} />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">정원</label>
                <input type="number" min={1} max={50} value={form.capacity} onChange={(e) => p({ capacity: parseInt(e.target.value) || 12 })} className={INPUT} />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">현재 수강 인원</label>
                <input type="number" min={0} value={form.enrolled} onChange={(e) => p({ enrolled: parseInt(e.target.value) || 0 })} className={INPUT} />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">담당 코치</label>
                <select value={form.coachId} onChange={(e) => p({ coachId: e.target.value })} className={INPUT}>
                    <option value="">-- 코치 미배정 --</option>
                    {coaches.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.role})</option>)}
                </select>
            </div>
            <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-600 mb-1">메모 / 특이사항</label>
                <input type="text" value={form.note} onChange={(e) => p({ note: e.target.value })} placeholder="예: 이번 주 보강 있음" className={INPUT} />
            </div>
            <div className="md:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={form.isHidden} onChange={(e) => p({ isHidden: e.target.checked })} className="w-4 h-4 rounded border-gray-300" />
                    <span className="text-sm text-gray-600 font-medium">공개 시간표에서 숨기기</span>
                </label>
            </div>
        </div>
    );
}
