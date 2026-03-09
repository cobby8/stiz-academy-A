"use client";

import { useState, useTransition } from "react";
import { upsertClassSlotOverride } from "@/app/actions/schedule";
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
}

interface SlotState {
    label: string;
    note: string;
    isHidden: boolean;
    capacity: number;
    coachId: string;  // "" = 미배정
    dirty: boolean;
    saved: boolean;
    error: string | null;
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
            dirty: false,
            saved: false,
            error: null,
        };
    }
    return map;
}

function defaultSlotState(): SlotState {
    return { label: "", note: "", isHidden: false, capacity: 12, coachId: "", dirty: false, saved: false, error: null };
}

export default function ScheduleAdminClient({
    slots,
    overrides,
    coaches,
    hasSheetUrl,
}: {
    slots: SheetClassSlot[];
    overrides: Override[];
    coaches: Coach[];
    hasSheetUrl: boolean;
}) {
    const [stateMap, setStateMap] = useState<Record<string, SlotState>>(
        () => buildInitialState(overrides)
    );
    const [pending, startTransition] = useTransition();

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

    const byDay = DAY_ORDER.reduce<Record<string, SheetClassSlot[]>>((acc, d) => {
        acc[d] = slots.filter((s) => s.dayKey === d).sort((a, b) => a.period - b.period);
        return acc;
    }, {});
    const activeDays = DAY_ORDER.filter((d) => byDay[d].length > 0);

    const INPUT = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-orange-500 focus:border-brand-orange-500 bg-gray-50 focus:bg-white";

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">시간표 관리</h1>
                <p className="text-gray-500 text-sm">
                    학년·인원은 구글시트에서 자동 동기화됩니다. 레이블·메모·숨김·정원·코치는 직접 편집할 수 있습니다.
                </p>
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
                            return (
                                <div key={slot.slotKey} className="p-5">
                                    {/* Read-only info */}
                                    <div className="flex flex-wrap items-center gap-3 mb-4">
                                        <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-full">
                                            {slot.period}교시
                                        </span>
                                        <span className="text-sm font-bold text-gray-800">
                                            {slot.startTime} ~ {slot.endTime}
                                        </span>
                                        {slot.gradeRange && (
                                            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-200">
                                                {slot.gradeRange}
                                            </span>
                                        )}
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                            slot.enrolled >= s.capacity
                                                ? "bg-red-100 text-red-700"
                                                : "bg-green-50 text-green-700"
                                        }`}>
                                            {slot.enrolled}/{s.capacity}명
                                            {slot.enrolled >= s.capacity && " 마감"}
                                        </span>
                                        <span className="text-xs text-gray-400 font-mono">{slot.slotKey}</span>

                                        {/* 배정된 코치 미리보기 */}
                                        {assignedCoach && (
                                            <span className="flex items-center gap-1.5 text-xs text-gray-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full">
                                                {assignedCoach.imageUrl && (
                                                    <img src={assignedCoach.imageUrl} className="w-4 h-4 rounded-full object-cover" alt="" />
                                                )}
                                                {assignedCoach.name}
                                            </span>
                                        )}
                                    </div>

                                    {/* Editable fields */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">
                                                표시 레이블
                                                <span className="font-normal text-gray-400 ml-1">(비워두면 "요일 n교시" 자동 생성)</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={s.label}
                                                onChange={(e) => update(slot.slotKey, { label: e.target.value })}
                                                placeholder={`${slot.dayLabel} ${slot.period}교시`}
                                                className={INPUT}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">
                                                정원 <span className="font-normal text-gray-400">(기본 12명)</span>
                                            </label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={50}
                                                value={s.capacity}
                                                onChange={(e) => update(slot.slotKey, { capacity: parseInt(e.target.value) || 12 })}
                                                className={INPUT}
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-gray-600 mb-1">
                                                메모 / 특이사항 <span className="font-normal text-gray-400">(공개 시간표에 표시됩니다)</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={s.note}
                                                onChange={(e) => update(slot.slotKey, { note: e.target.value })}
                                                placeholder="예: 이번 주 보강 있음, 코치 변경 예정"
                                                className={INPUT}
                                            />
                                        </div>

                                        {/* 코치 선택 */}
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-gray-600 mb-1">
                                                담당 코치 <span className="font-normal text-gray-400">(공개 시간표 카드에 표시됩니다)</span>
                                            </label>
                                            <div className="flex items-center gap-3">
                                                <select
                                                    value={s.coachId}
                                                    onChange={(e) => update(slot.slotKey, { coachId: e.target.value })}
                                                    className={INPUT + " flex-1"}
                                                >
                                                    <option value="">-- 코치 미배정 --</option>
                                                    {coaches.map((c) => (
                                                        <option key={c.id} value={c.id}>
                                                            {c.name} ({c.role})
                                                        </option>
                                                    ))}
                                                </select>
                                                {s.coachId && coachMap[s.coachId]?.imageUrl && (
                                                    <img
                                                        src={coachMap[s.coachId].imageUrl!}
                                                        alt=""
                                                        className="w-9 h-9 rounded-full object-cover border border-gray-200 shrink-0"
                                                    />
                                                )}
                                            </div>
                                            {coaches.length === 0 && (
                                                <p className="text-xs text-amber-600 mt-1">
                                                    등록된 코치가 없습니다.{" "}
                                                    <a href="/admin/coaches" className="underline">코치 추가 →</a>
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Hidden toggle + Save */}
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={s.isHidden}
                                                onChange={(e) => update(slot.slotKey, { isHidden: e.target.checked })}
                                                className="w-4 h-4 rounded border-gray-300 text-brand-orange-500 focus:ring-brand-orange-500"
                                            />
                                            <span className="text-sm text-gray-600 font-medium">공개 시간표에서 숨기기</span>
                                        </label>

                                        <div className="flex items-center gap-3">
                                            {s.error && <span className="text-xs text-red-500">{s.error}</span>}
                                            {s.saved && !s.dirty && (
                                                <span className="text-xs text-green-600 font-medium">✓ 저장됨</span>
                                            )}
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
        </div>
    );
}
