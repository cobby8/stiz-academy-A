"use client";

/**
 * 수강 신청 폼 — 4단계 스텝 폼 (모바일 퍼스트)
 *
 * Step 1: 아이 정보 (이름, 생년월일, 성별, 학년, 학교명, 학생 휴대폰)
 * Step 2: 보호자 정보 (이름, 연락처, 관계, 주소)
 * Step 3: 수강 정보 (희망 수업, 유니폼, 셔틀, 결제수단, 가입경로, 요청사항)
 * Step 4: 확인 + 동의 (입력 정보 요약, 이용약관, 개인정보 동의, honeypot)
 *
 * trialData가 있으면 체험 데이터를 자동 채움 (수정 가능)
 */

import { useState, useTransition } from "react";
import {
    submitEnrollApplication,
    type AvailableSlot,
    type TrialLeadForEnroll,
} from "@/app/actions/public";
import Link from "next/link";

// ── Props 타입 ───────────────────────────────────────────────────────────────
interface Props {
    availableSlots: AvailableSlot[];
    contactPhone: string;
    trialData: TrialLeadForEnroll | null;  // 체험 거친 경우 자동 채움 데이터
    trialLeadId: string | null;            // TrialLead ID (DB 연결용)
}

// ── 학년 옵션 ────────────────────────────────────────────────────────────────
const GRADE_OPTIONS = [
    "7세", "초1", "초2", "초3", "초4", "초5", "초6",
    "중1", "중2", "중3", "성인",
];

// ── 가입 경로 옵션 (9개) ────────────────────────────────────────────────────
const SOURCE_OPTIONS = [
    { value: "REFERRAL", label: "지인소개" },
    { value: "PASSBY", label: "지나가다 발견" },
    { value: "NAVER_SEARCH", label: "네이버 키워드 검색" },
    { value: "NAVER_BLOG", label: "네이버 블로그" },
    { value: "PORTAL_OTHER", label: "기타 포털검색(다음/구글)" },
    { value: "INSTAGRAM", label: "인스타그램" },
    { value: "SOOMGO", label: "숨고" },
    { value: "EXISTING_STUDENT", label: "기존 수강생" },
    { value: "OTHER", label: "기타" },
];

// ── 보호자 관계 옵션 ────────────────────────────────────────────────────────
const RELATION_OPTIONS = ["부", "모", "기타"];

// ── 요일 정렬 순서 + 한글 라벨 ──────────────────────────────────────────────
const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LABELS: Record<string, string> = {
    Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};

// ── 폼 데이터 타입 ──────────────────────────────────────────────────────────
interface FormData {
    childName: string;
    childBirthDate: string;
    childGender: string;
    childGrade: string;
    childSchool: string;
    childPhone: string;
    parentName: string;
    parentPhone: string;
    parentRelation: string;
    address: string;
    preferredSlotKeys: string[];  // 복수 선택 가능 ["Mon-4", "Wed-6"]
    shuttleNeeded: boolean;
    shuttlePickup: string;
    referralSource: string;
    memo: string;
    agreedTerms: boolean;
    agreedPrivacy: boolean;
    honeypot: string;
}

// ── 스텝 라벨 (4단계) ───────────────────────────────────────────────────────
const STEP_LABELS = ["아이 정보", "보호자", "수강 정보", "확인/동의"];
const TOTAL_STEPS = 4;

export default function EnrollApplicationForm({
    availableSlots,
    contactPhone,
    trialData,
    trialLeadId,
}: Props) {
    // 체험 데이터가 있으면 초기값으로 채움 (사용자가 수정 가능)
    const [step, setStep] = useState(1);
    const [form, setForm] = useState<FormData>({
        childName: trialData?.childName || "",
        childBirthDate: trialData?.childBirthDate || "",
        childGender: trialData?.childGender || "",
        childGrade: trialData?.childGrade || "",
        childSchool: "",
        childPhone: "",
        parentName: trialData?.parentName || "",
        parentPhone: trialData?.parentPhone || "",
        parentRelation: "",
        address: "",
        preferredSlotKeys: [],
        shuttleNeeded: false,
        shuttlePickup: "",
        referralSource: trialData?.source || "",
        memo: "",
        agreedTerms: false,
        agreedPrivacy: false,
        honeypot: "",
    });
    const [error, setError] = useState("");
    const [completed, setCompleted] = useState(false);
    const [isPending, startTransition] = useTransition();

    // 폼 필드 변경 핸들러
    const update = (field: keyof FormData, value: string | boolean | string[]) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setError("");
    };

    // ── Step 1 유효성 검사: 아이 정보 ───────────────────────────────────────
    const validateStep1 = (): boolean => {
        if (!form.childName.trim()) { setError("아이 이름을 입력해주세요."); return false; }
        if (!form.childBirthDate) { setError("아이 생년월일을 선택해주세요."); return false; }
        if (!form.childGender) { setError("성별을 선택해주세요."); return false; }
        if (!form.childGrade) { setError("학년을 선택해주세요."); return false; }
        if (!form.childSchool.trim()) { setError("학교명을 입력해주세요."); return false; }
        return true;
    };

    // ── Step 2 유효성 검사: 보호자 정보 ─────────────────────────────────────
    const validateStep2 = (): boolean => {
        if (!form.parentName.trim()) { setError("보호자 이름을 입력해주세요."); return false; }
        if (!form.parentPhone.trim()) { setError("보호자 연락처를 입력해주세요."); return false; }
        const digits = form.parentPhone.replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 11) {
            setError("올바른 전화번호를 입력해주세요. (예: 010-1234-5678)");
            return false;
        }
        return true;
    };

    // Step 3은 필수 입력 없음 (모두 선택사항)

    // ── 다음 단계 ────────────────────────────────────────────────────────────
    const goNext = () => {
        if (step === 1 && !validateStep1()) return;
        if (step === 2 && !validateStep2()) return;
        setError("");
        setStep((s) => Math.min(s + 1, TOTAL_STEPS));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // ── 이전 단계 ────────────────────────────────────────────────────────────
    const goBack = () => {
        setError("");
        setStep((s) => Math.max(s - 1, 1));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // ── 슬롯 선택 토글 (복수 선택 가능) ─────────────────────────────────────
    const toggleSlot = (slotKey: string) => {
        const keys = form.preferredSlotKeys;
        if (keys.includes(slotKey)) {
            update("preferredSlotKeys", keys.filter((k) => k !== slotKey));
        } else {
            update("preferredSlotKeys", [...keys, slotKey]);
        }
    };

    // ── 제출 ─────────────────────────────────────────────────────────────────
    const handleSubmit = () => {
        if (!form.agreedTerms || !form.agreedPrivacy) {
            setError("이용약관과 개인정보 수집/이용에 모두 동의해주세요.");
            return;
        }
        startTransition(async () => {
            try {
                await submitEnrollApplication({
                    trialLeadId: trialLeadId || undefined,
                    childName: form.childName,
                    childBirthDate: form.childBirthDate,
                    childGender: form.childGender || undefined,
                    childGrade: form.childGrade || undefined,
                    childSchool: form.childSchool || undefined,
                    childPhone: form.childPhone || undefined,
                    parentName: form.parentName,
                    parentPhone: form.parentPhone,
                    parentRelation: form.parentRelation || undefined,
                    address: form.address || undefined,
                    preferredSlotKeys: form.preferredSlotKeys.join(",") || undefined,
                    shuttleNeeded: form.shuttleNeeded,
                    shuttlePickup: form.shuttlePickup || undefined,
                    referralSource: form.referralSource || undefined,
                    memo: form.memo || undefined,
                    agreedTerms: form.agreedTerms,
                    agreedPrivacy: form.agreedPrivacy,
                    honeypot: form.honeypot,
                });
                setCompleted(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
            } catch (e: any) {
                setError(e.message || "신청 중 오류가 발생했습니다.");
            }
        });
    };

    // ── 완료 화면 ────────────────────────────────────────────────────────────
    if (completed) {
        return (
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-green-600 text-4xl">check_circle</span>
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-3">수강 신청이 완료되었습니다!</h2>
                <p className="text-gray-600 mb-2">담당자가 빠른 시간 내에 연락드리겠습니다.</p>
                <p className="text-gray-500 text-sm mb-6">
                    문의사항이 있으시면{" "}
                    <a href={`tel:${contactPhone.replace(/-/g, "")}`} className="text-brand-orange-500 font-semibold">
                        {contactPhone}
                    </a>
                    으로 전화해주세요.
                </p>
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-brand-navy-900 text-white rounded-xl font-medium hover:bg-brand-navy-800 transition-colors"
                >
                    <span className="material-symbols-outlined text-lg">home</span>
                    홈으로 돌아가기
                </Link>
            </div>
        );
    }

    // ── 슬롯을 요일별로 그룹핑 (시간표 그리드용) ─────────────────────────────
    const slotsByDay = DAY_ORDER.reduce<Record<string, AvailableSlot[]>>((acc, day) => {
        const daySlots = availableSlots.filter((s) => s.dayOfWeek === day);
        if (daySlots.length > 0) acc[day] = daySlots;
        return acc;
    }, {});

    // ── 선택한 슬롯을 읽기 좋은 문자열로 변환 (요약 표시용) ─────────────────
    const selectedSlotsLabel = form.preferredSlotKeys
        .map((key) => {
            const slot = availableSlots.find((s) => s.slotKey === key);
            if (!slot) return key;
            return `${slot.dayLabel} ${slot.startTime}~${slot.endTime} (${slot.className})`;
        })
        .join(", ");

    return (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* 진행 표시줄 — 4단계 */}
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between max-w-md mx-auto">
                    {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
                        <div key={n} className="flex items-center">
                            {/* 스텝 번호 원형 — 완료/현재/미래 색상 분기 */}
                            <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                                    n < step
                                        ? "bg-green-500 text-white"
                                        : n === step
                                        ? "bg-brand-orange-500 text-white"
                                        : "bg-gray-200 text-gray-400"
                                }`}
                            >
                                {n < step ? (
                                    <span className="material-symbols-outlined text-lg">check</span>
                                ) : (
                                    n
                                )}
                            </div>
                            {/* 스텝 이름 — 모바일에서는 숨김 */}
                            <span className={`ml-1.5 text-xs font-medium hidden sm:inline ${
                                n === step ? "text-gray-900" : "text-gray-400"
                            }`}>
                                {STEP_LABELS[n - 1]}
                            </span>
                            {/* 연결선 */}
                            {n < TOTAL_STEPS && (
                                <div className={`w-6 sm:w-8 h-0.5 mx-1.5 ${
                                    n < step ? "bg-green-500" : "bg-gray-200"
                                }`} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* 체험 데이터 자동 채움 알림 배너 */}
            {trialData && step === 1 && (
                <div className="mx-6 mt-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">auto_fix_high</span>
                    체험수업 정보가 자동으로 입력되었습니다. 필요하면 수정할 수 있습니다.
                </div>
            )}

            {/* 폼 본문 */}
            <div className="p-6">
                {/* 에러 메시지 */}
                {error && (
                    <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">error</span>
                        {error}
                    </div>
                )}

                {/* ──────────── Step 1: 아이 정보 ──────────── */}
                {step === 1 && (
                    <div className="space-y-5">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span className="material-symbols-outlined text-brand-orange-500">child_care</span>
                            아이 정보
                        </h2>

                        {/* 아이 이름 (필수) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                아이 이름 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.childName}
                                onChange={(e) => update("childName", e.target.value)}
                                placeholder="홍길동"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500/50 focus:border-brand-orange-500 outline-none transition-colors text-gray-900"
                            />
                        </div>

                        {/* 생년월일 (필수) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                생년월일 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                min="1950-01-01" max="2025-12-31"
                                value={form.childBirthDate}
                                onChange={(e) => update("childBirthDate", e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500/50 focus:border-brand-orange-500 outline-none transition-colors text-gray-900"
                            />
                        </div>

                        {/* 성별 (필수) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                성별 <span className="text-red-500">*</span>
                            </label>
                            <div className="flex gap-3">
                                {["남", "여"].map((g) => (
                                    <button
                                        key={g}
                                        type="button"
                                        onClick={() => update("childGender", g)}
                                        className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
                                            form.childGender === g
                                                ? "border-brand-orange-500 bg-brand-orange-50 text-brand-orange-600"
                                                : "border-gray-300 text-gray-600 hover:border-gray-400"
                                        }`}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 학년 (필수) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                학년 <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={form.childGrade}
                                onChange={(e) => update("childGrade", e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500/50 focus:border-brand-orange-500 outline-none transition-colors text-gray-900 bg-white"
                            >
                                <option value="">선택해주세요</option>
                                {GRADE_OPTIONS.map((g) => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                        </div>

                        {/* 학교명 (필수) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                학교명 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.childSchool}
                                onChange={(e) => update("childSchool", e.target.value)}
                                placeholder="다산초등학교"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500/50 focus:border-brand-orange-500 outline-none transition-colors text-gray-900"
                            />
                        </div>

                        {/* 학생 휴대폰 (선택, 중학생 이상) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                학생 휴대폰 <span className="text-gray-400 text-xs font-normal">(선택, 중학생 이상)</span>
                            </label>
                            <input
                                type="tel"
                                value={form.childPhone}
                                onChange={(e) => {
                                    // 숫자만 추출 후 000-0000-0000 자동 포맷팅
                                    const nums = e.target.value.replace(/\D/g, "").slice(0, 11);
                                    let formatted = nums;
                                    if (nums.length > 7) formatted = `${nums.slice(0,3)}-${nums.slice(3,7)}-${nums.slice(7)}`;
                                    else if (nums.length > 3) formatted = `${nums.slice(0,3)}-${nums.slice(3)}`;
                                    update("childPhone", formatted);
                                }}
                                placeholder="숫자만 입력 (자동 변환: 010-1234-5678)"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500/50 focus:border-brand-orange-500 outline-none transition-colors text-gray-900"
                            />
                            <p className="text-xs text-gray-400 mt-1">숫자만 입력하면 자동으로 000-0000-0000 형식으로 변환됩니다</p>
                        </div>
                    </div>
                )}

                {/* ──────────── Step 2: 보호자 정보 ──────────── */}
                {step === 2 && (
                    <div className="space-y-5">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span className="material-symbols-outlined text-brand-orange-500">person</span>
                            보호자 정보
                        </h2>

                        {/* 보호자 이름 (필수) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                보호자 이름 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.parentName}
                                onChange={(e) => update("parentName", e.target.value)}
                                placeholder="홍부모"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500/50 focus:border-brand-orange-500 outline-none transition-colors text-gray-900"
                            />
                        </div>

                        {/* 보호자 연락처 (필수) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                보호자 연락처 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="tel"
                                value={form.parentPhone}
                                onChange={(e) => {
                                    // 숫자만 추출 후 000-0000-0000 자동 포맷팅
                                    const nums = e.target.value.replace(/\D/g, "").slice(0, 11);
                                    let formatted = nums;
                                    if (nums.length > 7) formatted = `${nums.slice(0,3)}-${nums.slice(3,7)}-${nums.slice(7)}`;
                                    else if (nums.length > 3) formatted = `${nums.slice(0,3)}-${nums.slice(3)}`;
                                    update("parentPhone", formatted);
                                }}
                                placeholder="숫자만 입력 (자동 변환: 010-1234-5678)"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500/50 focus:border-brand-orange-500 outline-none transition-colors text-gray-900"
                            />
                            <p className="text-xs text-gray-400 mt-1">숫자만 입력하면 자동으로 000-0000-0000 형식으로 변환됩니다</p>
                        </div>

                        {/* 관계 (드롭다운) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">관계</label>
                            <div className="flex gap-3">
                                {RELATION_OPTIONS.map((r) => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => update("parentRelation", r)}
                                        className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
                                            form.parentRelation === r
                                                ? "border-brand-orange-500 bg-brand-orange-50 text-brand-orange-600"
                                                : "border-gray-300 text-gray-600 hover:border-gray-400"
                                        }`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 주소 (선택) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                주소 <span className="text-gray-400 text-xs font-normal">(선택)</span>
                            </label>
                            <input
                                type="text"
                                value={form.address}
                                onChange={(e) => update("address", e.target.value)}
                                placeholder="다산동 000아파트 000호"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500/50 focus:border-brand-orange-500 outline-none transition-colors text-gray-900"
                            />
                        </div>
                    </div>
                )}

                {/* ──────────── Step 3: 수강 정보 ──────────── */}
                {step === 3 && (
                    <div className="space-y-5">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span className="material-symbols-outlined text-brand-orange-500">sports_basketball</span>
                            수강 정보
                        </h2>

                        {/* 희망 수업 선택 — 시간표 그리드 (복수 선택 가능) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                희망 수업 <span className="text-gray-400 text-xs font-normal">(복수 선택 가능)</span>
                            </label>
                            {Object.keys(slotsByDay).length > 0 ? (
                                <div className="space-y-3">
                                    {DAY_ORDER.filter((d) => slotsByDay[d]).map((day) => (
                                        <div key={day}>
                                            <p className="text-xs font-bold text-gray-500 mb-1.5 uppercase">
                                                {DAY_LABELS[day]}요일
                                            </p>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {slotsByDay[day]!.map((slot) => {
                                                    const isFull = slot.available <= 0;
                                                    const isSelected = form.preferredSlotKeys.includes(slot.slotKey);
                                                    return (
                                                        <button
                                                            key={slot.slotKey}
                                                            type="button"
                                                            disabled={isFull}
                                                            onClick={() => toggleSlot(slot.slotKey)}
                                                            className={`py-2.5 px-3 rounded-xl border text-xs font-medium transition-colors ${
                                                                isFull
                                                                    ? "border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed"
                                                                    : isSelected
                                                                    ? "border-brand-orange-500 bg-brand-orange-50 text-brand-orange-600 ring-2 ring-brand-orange-500/30"
                                                                    : "border-gray-300 text-gray-700 hover:border-brand-navy-400 cursor-pointer"
                                                            }`}
                                                        >
                                                            <span className="block font-semibold text-sm">
                                                                {slot.startTime}~{slot.endTime}
                                                            </span>
                                                            <span className="block mt-0.5 truncate">{slot.className}</span>
                                                            <span className={`block mt-1 ${
                                                                isFull ? "text-gray-300" : slot.available <= 3 ? "text-red-500" : "text-green-600"
                                                            }`}>
                                                                {isFull ? "마감" : `잔여 ${slot.available}석`}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-400 text-sm py-4 text-center">
                                    현재 조회 가능한 시간표가 없습니다. 신청 후 담당자가 안내해드립니다.
                                </p>
                            )}
                        </div>

                        {/* 셔틀 이용 여부 */}
                        <div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.shuttleNeeded}
                                    onChange={(e) => update("shuttleNeeded", e.target.checked)}
                                    className="w-5 h-5 rounded border-gray-300 text-brand-orange-500 focus:ring-brand-orange-500/50"
                                />
                                <span className="text-sm font-medium text-gray-700">셔틀 이용을 희망합니다</span>
                            </label>
                        </div>

                        {/* 셔틀 탑승 장소 — 셔틀 체크 시에만 표시 */}
                        {form.shuttleNeeded && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    셔틀 탑승 장소
                                </label>
                                <input
                                    type="text"
                                    value={form.shuttlePickup}
                                    onChange={(e) => update("shuttlePickup", e.target.value)}
                                    placeholder="예: 다산 자이 아파트 정문 앞"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500/50 focus:border-brand-orange-500 outline-none transition-colors text-gray-900"
                                />
                            </div>
                        )}

                        {/* 가입 경로 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">어떻게 알게 되셨나요?</label>
                            <select
                                value={form.referralSource}
                                onChange={(e) => update("referralSource", e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500/50 focus:border-brand-orange-500 outline-none transition-colors text-gray-900 bg-white"
                            >
                                <option value="">선택해주세요</option>
                                {SOURCE_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* 기타 요청사항 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                기타 요청사항 <span className="text-gray-400 text-xs font-normal">(선택)</span>
                            </label>
                            <textarea
                                value={form.memo}
                                onChange={(e) => update("memo", e.target.value)}
                                placeholder="궁금하신 점이나 요청사항을 자유롭게 적어주세요"
                                rows={3}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500/50 focus:border-brand-orange-500 outline-none transition-colors text-gray-900 resize-none"
                            />
                        </div>
                    </div>
                )}

                {/* ──────────── Step 4: 확인 + 동의 ──────────── */}
                {step === 4 && (
                    <div className="space-y-5">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span className="material-symbols-outlined text-brand-orange-500">verified</span>
                            입력 정보 확인 및 동의
                        </h2>

                        {/* 입력 정보 요약 — 제출 전 최종 확인용 */}
                        <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
                            {/* 아이 정보 요약 */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-1.5 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm text-gray-500">child_care</span>
                                    아이 정보
                                </h3>
                                <div className="grid grid-cols-2 gap-y-1 gap-x-4 pl-5">
                                    <span className="text-gray-500">이름</span>
                                    <span className="text-gray-900 font-medium">{form.childName}</span>
                                    <span className="text-gray-500">생년월일</span>
                                    <span className="text-gray-900">{form.childBirthDate}</span>
                                    <span className="text-gray-500">성별</span>
                                    <span className="text-gray-900">{form.childGender}</span>
                                    <span className="text-gray-500">학년</span>
                                    <span className="text-gray-900">{form.childGrade}</span>
                                    <span className="text-gray-500">학교</span>
                                    <span className="text-gray-900">{form.childSchool}</span>
                                    {form.childPhone && (
                                        <>
                                            <span className="text-gray-500">학생 연락처</span>
                                            <span className="text-gray-900">{form.childPhone}</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <hr className="border-gray-200" />

                            {/* 보호자 정보 요약 */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-1.5 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm text-gray-500">person</span>
                                    보호자 정보
                                </h3>
                                <div className="grid grid-cols-2 gap-y-1 gap-x-4 pl-5">
                                    <span className="text-gray-500">이름</span>
                                    <span className="text-gray-900 font-medium">{form.parentName}</span>
                                    <span className="text-gray-500">연락처</span>
                                    <span className="text-gray-900">{form.parentPhone}</span>
                                    {form.parentRelation && (
                                        <>
                                            <span className="text-gray-500">관계</span>
                                            <span className="text-gray-900">{form.parentRelation}</span>
                                        </>
                                    )}
                                    {form.address && (
                                        <>
                                            <span className="text-gray-500">주소</span>
                                            <span className="text-gray-900">{form.address}</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <hr className="border-gray-200" />

                            {/* 수강 정보 요약 */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-1.5 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm text-gray-500">sports_basketball</span>
                                    수강 정보
                                </h3>
                                <div className="grid grid-cols-2 gap-y-1 gap-x-4 pl-5">
                                    {selectedSlotsLabel && (
                                        <>
                                            <span className="text-gray-500">희망 수업</span>
                                            <span className="text-gray-900">{selectedSlotsLabel}</span>
                                        </>
                                    )}
                                    {form.shuttleNeeded && (
                                        <>
                                            <span className="text-gray-500">셔틀</span>
                                            <span className="text-gray-900">{form.shuttlePickup || "이용 희망"}</span>
                                        </>
                                    )}
                                    {form.memo && (
                                        <>
                                            <span className="text-gray-500">요청사항</span>
                                            <span className="text-gray-900">{form.memo}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 이용약관 동의 */}
                        <TermsAccordion
                            title="이용약관 동의"
                            required
                            checked={form.agreedTerms}
                            onCheck={(v) => update("agreedTerms", v)}
                        >
                            <EnrollTermsContent />
                        </TermsAccordion>

                        {/* 개인정보 수집/이용 동의 */}
                        <TermsAccordion
                            title="개인정보 수집/이용 동의"
                            required
                            checked={form.agreedPrivacy}
                            onCheck={(v) => update("agreedPrivacy", v)}
                        >
                            <EnrollPrivacyContent />
                        </TermsAccordion>

                        {/* honeypot 필드 — 스팸봇 차단용, 사용자에게 보이지 않음 */}
                        <div className="absolute left-[-9999px]" aria-hidden="true">
                            <input
                                type="text"
                                tabIndex={-1}
                                value={form.honeypot}
                                onChange={(e) => update("honeypot", e.target.value)}
                                autoComplete="off"
                            />
                        </div>
                    </div>
                )}

                {/* ── 네비게이션 버튼 ─────────────────────────────────────────── */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
                    {step > 1 ? (
                        <button
                            type="button"
                            onClick={goBack}
                            className="flex items-center gap-1 px-5 py-3 text-gray-600 hover:text-gray-900 font-medium transition-colors cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-lg">arrow_back</span>
                            이전
                        </button>
                    ) : (
                        <div />
                    )}

                    {step < TOTAL_STEPS ? (
                        <button
                            type="button"
                            onClick={goNext}
                            className="flex items-center gap-1 px-6 py-3 bg-brand-orange-500 text-white rounded-xl font-medium hover:bg-brand-orange-600 transition-colors cursor-pointer"
                        >
                            다음
                            <span className="material-symbols-outlined text-lg">arrow_forward</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isPending}
                            className="flex items-center gap-2 px-8 py-3 bg-brand-orange-500 text-white rounded-xl font-bold hover:bg-brand-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isPending ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                                    처리 중...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-lg">how_to_reg</span>
                                    수강 신청하기
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── 약관 아코디언 컴포넌트 (체험 폼과 동일 패턴 재사용) ─────────────────────
function TermsAccordion({
    title,
    required,
    checked,
    onCheck,
    children,
}: {
    title: string;
    required?: boolean;
    checked: boolean;
    onCheck: (v: boolean) => void;
    children: React.ReactNode;
}) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center px-4 py-3 bg-gray-50">
                <label className="flex items-center gap-2 flex-1 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => onCheck(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-brand-orange-500 focus:ring-brand-orange-500/50"
                    />
                    <span className="text-sm font-medium text-gray-900">
                        {title} {required && <span className="text-red-500">*</span>}
                    </span>
                </label>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                >
                    <span className={`material-symbols-outlined text-lg transition-transform ${isOpen ? "rotate-180" : ""}`}>
                        expand_more
                    </span>
                </button>
            </div>
            {isOpen && (
                <div className="px-4 py-3 border-t border-gray-100 max-h-48 overflow-y-auto text-xs text-gray-600 leading-relaxed">
                    {children}
                </div>
            )}
        </div>
    );
}

// ── 수강 신청 이용약관 내용 ──────────────────────────────────────────────────
function EnrollTermsContent() {
    return (
        <div className="space-y-2">
            <p className="font-semibold text-gray-800">STIZ 농구교실 수강 이용약관</p>
            <p>1. 수강료는 수강 시작 2주 전부터 수강일 전까지 납부합니다.</p>
            <p>2. 개인 사정(여행, 행사, 늦잠 등)에 의한 결석은 이월/환불 대상이 아닙니다.</p>
            <p>3. 본인의 질병/부상(진단서 제출 가능한 경우)이나 직계존비속 경조사는 확인 후 이월 또는 환불이 가능합니다.</p>
            <p>4. 보강 수업은 결석일로부터 2개월 이내에 참여해야 하며, 2개월이 지나면 자동 소멸됩니다.</p>
            <p>5. 모든 수강생은 입단과 동시에 유니폼을 구매해야 합니다.</p>
            <p>6. 수업 중 운동복과 실내운동화를 반드시 착용해야 하며, 미착용 시 수업 참여가 제한될 수 있습니다.</p>
            <p>7. 수업 중 코치의 안전 지시를 따라주세요. 안전교육 미준수로 인한 부상은 보상이 어려울 수 있습니다.</p>
        </div>
    );
}

// ── 수강 신청 개인정보 수집/이용 동의 내용 ───────────────────────────────────
function EnrollPrivacyContent() {
    return (
        <div className="space-y-2">
            <p className="font-semibold text-gray-800">개인정보 수집/이용 동의</p>
            <p><strong>수집 항목:</strong> 아이 이름, 생년월일, 성별, 학년, 학교명, 학생 연락처, 보호자 이름, 보호자 연락처, 관계, 주소</p>
            <p><strong>수집 목적:</strong> 수강 신청 접수, 반 배정, 수강료 안내, 셔틀 운행, 수업 운영</p>
            <p><strong>보유 기간:</strong> 수강 종료 후 1년 (미등록 시 6개월)</p>
            <p><strong>동의 거부 권리:</strong> 동의를 거부할 수 있으나, 동의하지 않을 경우 수강 신청이 불가합니다.</p>
            <p>수집된 개인정보는 목적 외 용도로 사용되지 않으며, 제3자에게 제공되지 않습니다.</p>
        </div>
    );
}
