"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    upsertClassSlotOverride,
    createCustomSlot,
    updateCustomSlot,
    deleteCustomSlot,
} from "@/app/actions/schedule";
import { updateAcademySettings } from "@/app/actions/admin";
import type { SheetClassSlot } from "@/lib/googleSheetsSchedule";
import ScheduleTableView from "@/components/ScheduleTableView";
import type { MergedSlot } from "@/app/schedule/ScheduleClient";

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

interface Program {
    id: string;
    name: string;
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
    programId?: string | null;
}

interface SlotState {
    label: string;
    note: string;
    isHidden: boolean;
    capacity: number;
    coachId: string;
    startTimeOverride: string;
    endTimeOverride: string;
    programId: string;
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
    programId: string | null;
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
    programId: string;
}

function defaultCustomSlotForm(): CustomSlotForm {
    return { dayKey: "Mon", startTime: "14:00", endTime: "15:00", label: "", gradeRange: "", enrolled: 0, capacity: 12, note: "", isHidden: false, coachId: "", programId: "" };
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
            programId: o.programId ?? "",
            dirty: false,
            saved: false,
            error: null,
        };
    }
    return map;
}

function defaultSlotState(): SlotState {
    return { label: "", note: "", isHidden: false, capacity: 12, coachId: "", startTimeOverride: "", endTimeOverride: "", programId: "", dirty: false, saved: false, error: null };
}

const INPUT = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-orange-500 focus:border-brand-orange-500 bg-gray-50 focus:bg-white";
const TIME_INPUT = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-orange-500 focus:border-brand-orange-500 bg-gray-50 focus:bg-white";

export default function ScheduleAdminClient({
    slots,
    overrides,
    coaches,
    customSlots: initialCustomSlots,
    hasSheetUrl,
    sheetUrl,
    programs,
}: {
    slots: SheetClassSlot[];
    overrides: Override[];
    coaches: Coach[];
    customSlots: CustomSlot[];
    hasSheetUrl: boolean;
    sheetUrl: string | null;
    programs: Program[];
}) {
    const router = useRouter();
    const [stateMap, setStateMap] = useState<Record<string, SlotState>>(() => buildInitialState(overrides));
    const [pending, startTransition] = useTransition();

    // Google Sheets modal state
    const [showSheetModal, setShowSheetModal] = useState(false);
    const [sheetUrlInput, setSheetUrlInput] = useState(sheetUrl || "");
    const [sheetSaving, setSheetSaving] = useState(false);
    const [sheetSaved, setSheetSaved] = useState(false);
    const [sheetError, setSheetError] = useState<string | null>(null);

    async function handleSaveSheetUrl() {
        setSheetSaving(true);
        setSheetError(null);
        try {
            await updateAcademySettings({ googleSheetsScheduleUrl: sheetUrlInput });
            setSheetSaved(true);
            setTimeout(() => {
                setShowSheetModal(false);
                setSheetSaved(false);
                router.refresh();
            }, 800);
        } catch (e: any) {
            setSheetError(e.message || "저장 실패");
        } finally {
            setSheetSaving(false);
        }
    }

    // Custom slot state
    const [isAddingCustom, setIsAddingCustom] = useState(false);
    // 커스텀 슬롯 추가 시 기본 요일을 지정하기 위한 state
    const [addCustomDayKey, setAddCustomDayKey] = useState<string>("Mon");
    const [newCustomForm, setNewCustomForm] = useState<CustomSlotForm>(defaultCustomSlotForm);
    const [editingCustomId, setEditingCustomId] = useState<string | null>(null);
    const [editCustomForm, setEditCustomForm] = useState<CustomSlotForm>(defaultCustomSlotForm);
    const [customPending, startCustomTransition] = useTransition();
    const [deletingCustomId, setDeletingCustomId] = useState<string | null>(null);

    // 시트 슬롯 편집 모달 state — 클릭한 슬롯의 slotKey를 저장
    const [editingSlotKey, setEditingSlotKey] = useState<string | null>(null);

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
                    programId: s.programId || null,
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
                    programId: newCustomForm.programId || null,
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
            capacity: cs.capacity, note: cs.note ?? "", isHidden: cs.isHidden,
            coachId: cs.coachId ?? "", programId: cs.programId ?? "",
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
                    programId: editCustomForm.programId || null,
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

    // 시트 슬롯을 요일별로 그룹핑 (period 기준 정렬)
    const sheetByDay = DAY_ORDER.reduce<Record<string, SheetClassSlot[]>>((acc, d) => {
        acc[d] = slots.filter((s) => s.dayKey === d).sort((a, b) => a.period - b.period);
        return acc;
    }, {});
    // 커스텀 슬롯도 요일별로 그룹핑 (startTime 기준 정렬)
    const customByDay = DAY_ORDER.reduce<Record<string, CustomSlot[]>>((acc, d) => {
        acc[d] = initialCustomSlots.filter((cs) => cs.dayKey === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
        return acc;
    }, {});
    // 시트 슬롯 또는 커스텀 슬롯이 하나라도 있는 요일만 표시
    const activeDays = DAY_ORDER.filter((d) => sheetByDay[d].length > 0 || customByDay[d].length > 0);

    // 관리자 뷰 토글 상태 — "edit"(편집 모드) / "table"(표 미리보기)
    const [adminViewMode, setAdminViewMode] = useState<"edit" | "table">("edit");

    // SheetClassSlot + CustomSlot -> MergedSlot 변환 (표 뷰 전용)
    const mergedSlotsForTable = useMemo<MergedSlot[]>(() => {
        const result: MergedSlot[] = [];
        for (const slot of slots) {
            const s = stateMap[slot.slotKey];
            const isHidden = s?.isHidden ?? false;
            if (isHidden) continue;
            const coachId = s?.coachId || null;
            const coach = coachId ? coachMap[coachId] ?? null : null;
            result.push({
                slotKey: slot.slotKey,
                dayKey: slot.dayKey,
                dayLabel: slot.dayLabel,
                startTime: s?.startTimeOverride || slot.startTime,
                endTime: s?.endTimeOverride || slot.endTime,
                gradeRange: slot.gradeRange,
                enrolled: slot.enrolled,
                displayLabel: s?.label || `${slot.period}교시`,
                note: s?.note || null,
                capacity: s?.capacity ?? 12,
                isFull: slot.enrolled >= (s?.capacity ?? 12),
                coach: coach ? { name: coach.name, role: coach.role, imageUrl: coach.imageUrl } : null,
                programId: s?.programId || null,
            });
        }
        for (const cs of initialCustomSlots) {
            if (cs.isHidden) continue;
            result.push({
                slotKey: `custom-${cs.id}`,
                dayKey: cs.dayKey,
                dayLabel: DAY_LABEL[cs.dayKey] || cs.dayKey,
                startTime: cs.startTime,
                endTime: cs.endTime,
                gradeRange: cs.gradeRange || "",
                enrolled: cs.enrolled,
                displayLabel: cs.label,
                note: cs.note,
                capacity: cs.capacity,
                isFull: cs.enrolled >= cs.capacity,
                coach: cs.coach ? { name: cs.coach.name, role: cs.coach.role, imageUrl: cs.coach.imageUrl } : null,
                programId: cs.programId,
            });
        }
        return result;
    }, [slots, stateMap, initialCustomSlots, coachMap]);

    // 현재 편집 모달이 열린 시트 슬롯 객체 찾기
    const editingSheetSlot = editingSlotKey ? slots.find((s) => s.slotKey === editingSlotKey) : null;

    return (
        <div className="space-y-8">
            {/* 페이지 헤더 */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">수업시간표 관리</h1>
                    <p className="text-gray-500 text-sm">
                        학년·인원은 구글시트에서 자동 동기화됩니다. 카드를 클릭하면 편집할 수 있습니다.
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {/* 편집/표 뷰 토글 */}
                    <div className="flex rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        <button
                            onClick={() => setAdminViewMode("edit")}
                            className={`flex items-center gap-1 px-3 py-2 text-sm font-bold transition-colors ${
                                adminViewMode === "edit"
                                    ? "bg-brand-navy-900 text-white"
                                    : "bg-white text-gray-500 hover:bg-gray-50"
                            }`}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>edit</span>
                            편집
                        </button>
                        <button
                            onClick={() => setAdminViewMode("table")}
                            className={`flex items-center gap-1 px-3 py-2 text-sm font-bold transition-colors ${
                                adminViewMode === "table"
                                    ? "bg-brand-navy-900 text-white"
                                    : "bg-white text-gray-500 hover:bg-gray-50"
                            }`}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>table_chart</span>
                            표 보기
                        </button>
                    </div>
                    <button
                        onClick={() => { setSheetUrlInput(sheetUrl || ""); setShowSheetModal(true); }}
                        className={`bg-white border text-sm font-bold px-4 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5 ${hasSheetUrl ? "border-green-300 text-green-800 hover:bg-green-50" : "border-amber-300 text-amber-800 hover:bg-amber-50"}`}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>link</span>
                        구글시트 연동{hasSheetUrl ? " " : " 설정"}
                        {hasSheetUrl && <span className="material-symbols-outlined text-green-600" style={{ fontSize: "16px" }}>check_circle</span>}
                    </button>
                </div>
            </div>

            {/* 표 보기 모드 — 공개 시간표 미리보기 (편집 불가) */}
            {adminViewMode === "table" && (
                <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
                        <span className="font-bold">미리보기 모드</span> — 학부모에게 보이는 시간표와 동일한 표 형태입니다. 편집하려면 "편집" 버튼을 눌러주세요.
                    </div>
                    <ScheduleTableView slots={mergedSlotsForTable} />
                </div>
            )}

            {adminViewMode === "edit" && !hasSheetUrl && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
                    <p className="font-bold mb-1">구글시트 URL이 설정되지 않았습니다.</p>
                    <p>
                        <button
                            onClick={() => setShowSheetModal(true)}
                            className="underline font-medium hover:text-amber-900"
                        >
                            구글시트 연동 설정
                        </button>
                        을 눌러 URL을 먼저 입력해 주세요.
                    </p>
                </div>
            )}

            {adminViewMode === "edit" && hasSheetUrl && slots.length === 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center text-gray-500">
                    <p className="text-lg font-medium mb-1">시트에서 수업 데이터를 찾을 수 없습니다.</p>
                    <p className="text-sm">시트가 공개 설정인지, URL과 탭(gid)이 올바른지 확인해 주세요.</p>
                </div>
            )}

            {/* ── 요일별 수업 카드 목록 (편집 모드) ── */}
            {adminViewMode === "edit" && activeDays.map((dayKey) => (
                <div key={dayKey} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* 요일 헤더 */}
                    <div className={`${DAY_COLOR[dayKey]} text-white px-5 py-3 flex items-center gap-3`}>
                        <span className="font-black text-lg">{DAY_LABEL[dayKey]}</span>
                        <span className="text-white/70 text-sm">{sheetByDay[dayKey].length + customByDay[dayKey].length}개 수업</span>
                    </div>

                    {/* 수업 카드 목록 — 컴팩트 한 줄 카드 */}
                    <div className="divide-y divide-gray-100">
                        {/* 시트 슬롯 — 클릭하면 편집 모달 열림 */}
                        {sheetByDay[dayKey].map((slot) => {
                            const s = getState(slot.slotKey);
                            const assignedCoach = s.coachId ? coachMap[s.coachId] : null;
                            const displayStart = s.startTimeOverride || slot.startTime;
                            const displayEnd = s.endTimeOverride || slot.endTime;
                            const isFull = slot.enrolled >= s.capacity;

                            return (
                                <button
                                    key={slot.slotKey}
                                    type="button"
                                    onClick={() => setEditingSlotKey(slot.slotKey)}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3 group"
                                >
                                    {/* 교시 뱃지 */}
                                    <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-full shrink-0">
                                        {slot.period}교시
                                    </span>

                                    {/* 시간 */}
                                    <span className="text-sm font-semibold text-gray-800 shrink-0">
                                        {displayStart} ~ {displayEnd}
                                    </span>
                                    {/* 시간 조정 표시 */}
                                    {s.startTimeOverride && (
                                        <span className="text-[10px] text-brand-orange-600 shrink-0">(조정)</span>
                                    )}

                                    {/* 레이블 (override 있을 때만) */}
                                    {s.label && (
                                        <span className="text-xs text-gray-500 shrink-0">{s.label}</span>
                                    )}

                                    {/* 학년 범위 */}
                                    {slot.gradeRange && (
                                        <span className="bg-blue-50 text-blue-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-blue-200 shrink-0">
                                            {slot.gradeRange}
                                        </span>
                                    )}

                                    {/* 인원 현황 */}
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                        isFull ? "bg-red-100 text-red-700" : "bg-green-50 text-green-700"
                                    }`}>
                                        {slot.enrolled}/{s.capacity}명{isFull && " 마감"}
                                    </span>

                                    {/* 코치 */}
                                    {assignedCoach && (
                                        <span className="flex items-center gap-1 text-[11px] text-gray-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full shrink-0">
                                            {assignedCoach.imageUrl && <img src={assignedCoach.imageUrl} className="w-3.5 h-3.5 rounded-full object-cover" alt="" />}
                                            {assignedCoach.name}
                                        </span>
                                    )}

                                    {/* 숨김 상태 표시 */}
                                    {s.isHidden && (
                                        <span className="flex items-center gap-0.5 text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                                            <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>visibility_off</span>
                                            숨김
                                        </span>
                                    )}

                                    {/* 메모 아이콘 (메모가 있을 때만) */}
                                    {s.note && (
                                        <span className="material-symbols-outlined text-brand-orange-400 shrink-0" style={{ fontSize: "16px" }}>push_pin</span>
                                    )}

                                    {/* 수정/저장 상태 — 우측 정렬 */}
                                    <span className="ml-auto flex items-center gap-2 shrink-0">
                                        {s.dirty && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="미저장 변경사항" />}
                                        {s.saved && !s.dirty && <span className="material-symbols-outlined text-green-500" style={{ fontSize: "16px" }}>check_circle</span>}
                                        {s.error && <span className="material-symbols-outlined text-red-500" style={{ fontSize: "16px" }}>error</span>}
                                        {/* 편집 아이콘 (hover 시 강조) */}
                                        <span className="material-symbols-outlined text-gray-300 group-hover:text-gray-500 transition-colors" style={{ fontSize: "18px" }}>chevron_right</span>
                                    </span>
                                </button>
                            );
                        })}

                        {/* 커스텀 슬롯 — 동일한 컴팩트 카드 */}
                        {customByDay[dayKey].map((cs) => {
                            const isFull = cs.enrolled >= cs.capacity;
                            return (
                                <button
                                    key={`custom-${cs.id}`}
                                    type="button"
                                    onClick={() => startEditCustom(cs)}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3 group"
                                >
                                    {/* 커스텀 뱃지 */}
                                    <span className="bg-brand-orange-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0">
                                        커스텀
                                    </span>

                                    {/* 시간 */}
                                    <span className="text-sm font-semibold text-gray-800 shrink-0">
                                        {cs.startTime} ~ {cs.endTime}
                                    </span>

                                    {/* 레이블 */}
                                    <span className="text-xs text-gray-600 font-medium shrink-0">{cs.label}</span>

                                    {/* 학년 범위 */}
                                    {cs.gradeRange && (
                                        <span className="bg-blue-50 text-blue-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-blue-200 shrink-0">
                                            {cs.gradeRange}
                                        </span>
                                    )}

                                    {/* 인원 현황 */}
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                        isFull ? "bg-red-100 text-red-700" : "bg-green-50 text-green-700"
                                    }`}>
                                        {cs.enrolled}/{cs.capacity}명{isFull && " 마감"}
                                    </span>

                                    {/* 코치 */}
                                    {cs.coach && (
                                        <span className="flex items-center gap-1 text-[11px] text-gray-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full shrink-0">
                                            {cs.coach.imageUrl && <img src={cs.coach.imageUrl} className="w-3.5 h-3.5 rounded-full object-cover" alt="" />}
                                            {cs.coach.name}
                                        </span>
                                    )}

                                    {/* 숨김 상태 */}
                                    {cs.isHidden && (
                                        <span className="flex items-center gap-0.5 text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                                            <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>visibility_off</span>
                                            숨김
                                        </span>
                                    )}

                                    {/* 메모 아이콘 */}
                                    {cs.note && (
                                        <span className="material-symbols-outlined text-brand-orange-400 shrink-0" style={{ fontSize: "16px" }}>push_pin</span>
                                    )}

                                    {/* 우측 편집 화살표 */}
                                    <span className="ml-auto shrink-0">
                                        <span className="material-symbols-outlined text-gray-300 group-hover:text-gray-500 transition-colors" style={{ fontSize: "18px" }}>chevron_right</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* 요일 섹션 하단: + 수업 추가 버튼 */}
                    <div className="px-4 py-3 border-t border-gray-100">
                        <button
                            onClick={() => {
                                // 해당 요일을 기본값으로 설정하고 추가 모달 열기
                                setAddCustomDayKey(dayKey);
                                setNewCustomForm({ ...defaultCustomSlotForm(), dayKey });
                                setIsAddingCustom(true);
                            }}
                            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-brand-orange-500 font-medium transition-colors"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add_circle</span>
                            수업 추가
                        </button>
                    </div>
                </div>
            ))}

            {/* ── 시트 슬롯 편집 모달 ── */}
            {editingSheetSlot && (() => {
                const slot = editingSheetSlot;
                const s = getState(slot.slotKey);
                return (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingSlotKey(null)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                            {/* 모달 헤더 */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                <div className="flex items-center gap-3">
                                    <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-full">
                                        {slot.period}교시
                                    </span>
                                    <span className="font-bold text-gray-800">
                                        {DAY_LABEL[slot.dayKey]} {slot.startTime} ~ {slot.endTime}
                                    </span>
                                    {slot.gradeRange && (
                                        <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full border border-blue-200">
                                            {slot.gradeRange}
                                        </span>
                                    )}
                                </div>
                                <button onClick={() => setEditingSlotKey(null)} className="text-gray-400 hover:text-gray-600">
                                    <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>close</span>
                                </button>
                            </div>

                            {/* 모달 본문 — 편집 필드 */}
                            <div className="p-6 space-y-4">
                                {/* 슬롯 키 (읽기 전용 참조) */}
                                <p className="text-xs text-gray-400 font-mono">{slot.slotKey}</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* 표시 레이블 */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">
                                            표시 레이블<span className="font-normal text-gray-400 ml-1">(비워두면 "n교시" 자동)</span>
                                        </label>
                                        <input type="text" value={s.label} onChange={(e) => update(slot.slotKey, { label: e.target.value })} placeholder={`${slot.dayLabel} ${slot.period}교시`} className={INPUT} />
                                    </div>

                                    {/* 정원 */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">정원<span className="font-normal text-gray-400 ml-1">(기본 12명)</span></label>
                                        <input type="number" min={1} max={50} value={s.capacity} onChange={(e) => update(slot.slotKey, { capacity: parseInt(e.target.value) || 12 })} className={INPUT} />
                                    </div>

                                    {/* 시작 시간 조정 */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">
                                            시작 시간 조정<span className="font-normal text-gray-400 ml-1">(기본: {slot.startTime})</span>
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input type="time" value={s.startTimeOverride} onChange={(e) => update(slot.slotKey, { startTimeOverride: e.target.value })} className={TIME_INPUT + " flex-1"} />
                                            {s.startTimeOverride && (
                                                <button type="button" onClick={() => update(slot.slotKey, { startTimeOverride: "" })} className="text-gray-400 hover:text-gray-600 shrink-0">
                                                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* 종료 시간 조정 */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">
                                            종료 시간 조정<span className="font-normal text-gray-400 ml-1">(기본: {slot.endTime})</span>
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input type="time" value={s.endTimeOverride} onChange={(e) => update(slot.slotKey, { endTimeOverride: e.target.value })} className={TIME_INPUT + " flex-1"} />
                                            {s.endTimeOverride && (
                                                <button type="button" onClick={() => update(slot.slotKey, { endTimeOverride: "" })} className="text-gray-400 hover:text-gray-600 shrink-0">
                                                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* 메모 */}
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-600 mb-1">
                                            메모 / 특이사항<span className="font-normal text-gray-400 ml-1">(공개 시간표에 표시)</span>
                                        </label>
                                        <input type="text" value={s.note} onChange={(e) => update(slot.slotKey, { note: e.target.value })} placeholder="예: 이번 주 보강 있음, 코치 변경 예정" className={INPUT} />
                                    </div>

                                    {/* 담당 코치 */}
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-600 mb-1">
                                            담당 코치<span className="font-normal text-gray-400 ml-1">(공개 시간표 카드에 표시)</span>
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
                                            <p className="text-xs text-amber-600 mt-1">등록된 코치가 없습니다. <a href="/admin/coaches" className="underline">코치 추가</a></p>
                                        )}
                                    </div>

                                    {/* 프로그램 분류 */}
                                    {programs.length > 0 && (
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-gray-600 mb-1">
                                                프로그램 분류<span className="font-normal text-gray-400 ml-1">(공개 시간표 필터에 사용)</span>
                                            </label>
                                            <select value={s.programId} onChange={(e) => update(slot.slotKey, { programId: e.target.value })} className={INPUT}>
                                                <option value="">-- 프로그램 미설정 --</option>
                                                {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {/* 숨기기 체크박스 */}
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" checked={s.isHidden} onChange={(e) => update(slot.slotKey, { isHidden: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-brand-orange-500 focus:ring-brand-orange-500" />
                                    <span className="text-sm text-gray-600 font-medium">공개 시간표에서 숨기기</span>
                                </label>
                            </div>

                            {/* 모달 푸터 — 저장/닫기 버튼 (우측 하단) */}
                            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                                <div className="flex items-center gap-2">
                                    {s.error && <span className="text-xs text-red-500 flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: "14px" }}>error</span>{s.error}</span>}
                                    {s.saved && !s.dirty && <span className="text-xs text-green-600 font-medium flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: "14px" }}>check_circle</span>저장됨</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setEditingSlotKey(null)}
                                        className="bg-white border border-gray-300 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition"
                                    >
                                        닫기
                                    </button>
                                    <button
                                        onClick={() => save(slot)}
                                        disabled={pending || !s.dirty}
                                        className="bg-brand-navy-900 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>save</span>
                                        {pending ? "저장 중..." : "저장"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── 커스텀 슬롯 편집 모달 ── */}
            {editingCustomId && (() => {
                const cs = initialCustomSlots.find((c) => c.id === editingCustomId);
                if (!cs) return null;
                return (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingCustomId(null)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                            {/* 모달 헤더 */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                <div className="flex items-center gap-3">
                                    <span className="bg-brand-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">커스텀</span>
                                    <span className="font-bold text-gray-800">수업 수정</span>
                                </div>
                                <button onClick={() => setEditingCustomId(null)} className="text-gray-400 hover:text-gray-600">
                                    <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>close</span>
                                </button>
                            </div>

                            {/* 모달 본문 */}
                            <div className="p-6">
                                <CustomSlotFormFields form={editCustomForm} onChange={setEditCustomForm} coaches={coaches} programs={programs} />
                            </div>

                            {/* 모달 푸터 — 삭제/저장 버튼 */}
                            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                                {/* 좌측: 삭제 버튼 */}
                                <div>
                                    {deletingCustomId === cs.id ? (
                                        <span className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">정말 삭제할까요?</span>
                                            <button onClick={() => handleDeleteCustom(cs.id)} disabled={customPending} className="text-xs text-red-600 hover:text-red-800 font-bold">삭제 확인</button>
                                            <button onClick={() => setDeletingCustomId(null)} className="text-xs text-gray-500 hover:text-gray-700">취소</button>
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => setDeletingCustomId(cs.id)}
                                            className="flex items-center gap-1 text-sm text-red-400 hover:text-red-600 font-medium transition-colors"
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>delete</span>
                                            삭제
                                        </button>
                                    )}
                                </div>

                                {/* 우측: 취소/저장 버튼 */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setEditingCustomId(null)}
                                        className="bg-white border border-gray-300 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition"
                                    >
                                        닫기
                                    </button>
                                    <button
                                        onClick={() => handleUpdateCustom(cs.id)}
                                        disabled={customPending || !editCustomForm.label.trim()}
                                        className="bg-brand-navy-900 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>save</span>
                                        {customPending ? "저장 중..." : "저장"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Google Sheets URL modal */}
            {showSheetModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSheetModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <span className="font-bold text-gray-800 text-base flex items-center gap-2">
                                <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>link</span>
                                구글시트 연동관리
                            </span>
                            <button onClick={() => setShowSheetModal(false)} className="text-gray-400 hover:text-gray-600">
                                <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>close</span>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800">
                                <p className="font-bold mb-1">URL 확인 방법</p>
                                <p>구글시트 열기 → 주소창 URL 복사</p>
                                <p className="mt-1 font-mono bg-green-100 px-2 py-1 rounded">spreadsheets/d/.../edit?gid=... 형태 그대로</p>
                                <p className="mt-1 font-bold">시트가 "링크가 있는 모든 사용자 - 뷰어" 공개 설정이어야 합니다.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">구글시트 URL</label>
                                <input
                                    type="url"
                                    value={sheetUrlInput}
                                    onChange={(e) => setSheetUrlInput(e.target.value)}
                                    placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..."
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-orange-500 focus:border-brand-orange-500"
                                />
                            </div>
                            {sheetError && (
                                <p className="text-sm text-red-600 font-medium flex items-center gap-1">
                                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>warning</span>
                                    {sheetError}
                                </p>
                            )}
                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={handleSaveSheetUrl}
                                    disabled={sheetSaving}
                                    className="bg-brand-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition disabled:opacity-40 flex items-center gap-2"
                                >
                                    {sheetSaving ? "저장 중..." : sheetSaved ? "저장됨" : "저장"}
                                </button>
                                <button
                                    onClick={() => setShowSheetModal(false)}
                                    className="bg-white border border-gray-300 text-gray-600 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-50 transition"
                                >
                                    취소
                                </button>
                                {sheetUrlInput && (
                                    <button
                                        onClick={() => setSheetUrlInput("")}
                                        className="ml-auto text-xs text-red-400 hover:text-red-600 font-medium"
                                    >
                                        URL 초기화
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 커스텀 수업 추가 모달 */}
            {isAddingCustom && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setIsAddingCustom(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <span className="font-bold text-gray-800 text-base flex items-center gap-2">
                                <span className="material-symbols-outlined text-brand-orange-500" style={{ fontSize: "20px" }}>add_circle</span>
                                새 수업 추가
                            </span>
                            <button onClick={() => setIsAddingCustom(false)} className="text-gray-400 hover:text-gray-600">
                                <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>close</span>
                            </button>
                        </div>
                        <div className="p-6">
                            <CustomSlotFormFields form={newCustomForm} onChange={setNewCustomForm} coaches={coaches} programs={programs} />
                        </div>
                        {/* 모달 푸터 */}
                        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl gap-2">
                            <button
                                onClick={() => setIsAddingCustom(false)}
                                className="bg-white border border-gray-300 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleAddCustom}
                                disabled={customPending || !newCustomForm.label.trim()}
                                className="bg-brand-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-5 py-2 rounded-lg transition disabled:opacity-40 flex items-center gap-1.5"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>add</span>
                                {customPending ? "저장 중..." : "저장"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── 커스텀 슬롯 폼 필드 (추가/수정 모달 공용) ── */
function CustomSlotFormFields({
    form,
    onChange,
    coaches,
    programs,
}: {
    form: CustomSlotForm;
    onChange: (f: CustomSlotForm) => void;
    coaches: Coach[];
    programs: Program[];
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
            {programs.length > 0 && (
                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">프로그램 분류</label>
                    <select value={form.programId} onChange={(e) => p({ programId: e.target.value })} className={INPUT}>
                        <option value="">-- 프로그램 미설정 --</option>
                        {programs.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
                    </select>
                </div>
            )}
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
