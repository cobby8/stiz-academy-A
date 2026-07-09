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
import dynamic from "next/dynamic";
import {
    submitEnrollApplication,
    type AvailableSlot,
    type TrialLeadForEnroll,
} from "@/app/actions/public";
import Link from "next/link";
import { trackMetaEvent } from "@/components/MetaPixel";

const EnrollApplicationLaterSteps = dynamic(() => import("./EnrollApplicationLaterSteps"), {
    loading: () => (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
            다음 단계를 불러오는 중...
        </div>
    ),
});

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
    basketballExp: string;        // 농구 경험
    shuttleNeeded: boolean;
    shuttlePickup: string;
    shuttleTime: string;          // 셔틀 희망 시간
    shuttleDropoff: string;       // 셔틀 하차 장소
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
        basketballExp: "",
        shuttleNeeded: false,
        shuttlePickup: "",
        shuttleTime: "",
        shuttleDropoff: "",
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
                    basketballExp: form.basketballExp || undefined,
                    shuttleNeeded: form.shuttleNeeded,
                    shuttlePickup: form.shuttlePickup || undefined,
                    shuttleTime: form.shuttleTime || undefined,
                    shuttleDropoff: form.shuttleDropoff || undefined,
                    referralSource: form.referralSource || undefined,
                    memo: form.memo || undefined,
                    agreedTerms: form.agreedTerms,
                    agreedPrivacy: form.agreedPrivacy,
                    honeypot: form.honeypot,
                });
                trackMetaEvent("CompleteRegistration", {
                    content_name: "Enrollment application",
                    content_category: "Application",
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
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-green-600 text-4xl">check_circle</span>
                </div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3">수강 신청이 완료되었습니다!</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-2">담당자가 빠른 시간 내에 연락드리겠습니다.</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                    문의사항이 있으시면{" "}
                    <a href={`tel:${contactPhone.replace(/-/g, "")}`} className="text-brand-orange-500 dark:text-brand-neon-lime font-semibold">
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

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
            {/* 진행 표시줄 — 4단계 */}
            <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between max-w-md mx-auto">
                    {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
                        <div key={n} className="flex items-center">
                            {/* 스텝 번호 원형 — 완료/현재/미래 색상 분기 */}
                            <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                                    n < step
                                        ? "bg-green-500 text-white"
                                        : n === step
                                        ? "bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white"
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
                                n === step ? "text-gray-900 dark:text-white" : "text-gray-400"
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
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-brand-orange-500 dark:text-brand-neon-lime">child_care</span>
                            아이 정보
                        </h2>

                        {/* 아이 이름 (필수) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                아이 이름 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.childName}
                                onChange={(e) => update("childName", e.target.value)}
                                placeholder="홍길동"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* 생년월일 (필수) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                생년월일 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                min="1950-01-01" max="2025-12-31"
                                value={form.childBirthDate}
                                onChange={(e) => update("childBirthDate", e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* 성별 (필수) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
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
                                                ? "border-brand-orange-500 dark:border-brand-neon-lime bg-brand-orange-50 dark:bg-brand-neon-lime/10  text-brand-orange-600 dark:text-brand-neon-lime"
                                                : "border-gray-300 text-gray-600 dark:text-gray-300 hover:border-gray-400"
                                        }`}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 학년 (필수) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                학년 <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={form.childGrade}
                                onChange={(e) => update("childGrade", e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                            >
                                <option value="">선택해주세요</option>
                                {GRADE_OPTIONS.map((g) => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                        </div>

                        {/* 학교명 (필수) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                학교명 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.childSchool}
                                onChange={(e) => update("childSchool", e.target.value)}
                                placeholder="다산초등학교"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* 학생 휴대폰 (선택, 중학생 이상) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
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
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white"
                            />
                            <p className="text-xs text-gray-400 mt-1">숫자만 입력하면 자동으로 000-0000-0000 형식으로 변환됩니다</p>
                        </div>
                    </div>
                )}

                {step > 1 && (
                    <EnrollApplicationLaterSteps
                        step={step}
                        form={form}
                        availableSlots={availableSlots}
                        update={update}
                        toggleSlot={toggleSlot}
                    />
                )}
                {/* ── 네비게이션 버튼 ─────────────────────────────────────────── */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
                    {step > 1 ? (
                        <button
                            type="button"
                            onClick={goBack}
                            className="flex items-center gap-1 px-5 py-3 text-gray-600 hover:text-gray-900 dark:text-white font-medium transition-colors cursor-pointer"
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
                            className="flex items-center gap-1 px-6 py-3 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white rounded-xl font-medium hover:bg-brand-orange-600 dark:hover:bg-lime-400 transition-colors cursor-pointer"
                        >
                            다음
                            <span className="material-symbols-outlined text-lg">arrow_forward</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isPending}
                            className="flex items-center gap-2 px-8 py-3 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white rounded-xl font-bold hover:bg-brand-orange-600 dark:hover:bg-lime-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
