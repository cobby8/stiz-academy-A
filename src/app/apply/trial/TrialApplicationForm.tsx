"use client";

/**
 * 체험수업 신청 폼 — 3단계 스텝 폼 (모바일 퍼스트)
 *
 * Step 1: 아이 정보 (이름, 생년월일, 학년, 농구 경험)
 * Step 2: 보호자 + 희망 수업 (보호자 정보, 시간표 슬롯 선택, 바라는 점, 가입경로)
 * Step 3: 동의 + 제출 (이용약관, 개인정보 동의, honeypot)
 */

import { useState, useTransition } from "react";
import { submitTrialApplication, type AvailableSlot } from "@/app/actions/public";
import Link from "next/link";

// ── Props 타입 ───────────────────────────────────────────────────────────────
interface Props {
    availableSlots: AvailableSlot[];
    contactPhone: string;
}

// ── 학년 옵션 ────────────────────────────────────────────────────────────────
const GRADE_OPTIONS = [
    "7세", "초1", "초2", "초3", "초4", "초5", "초6",
    "중1", "중2", "중3", "성인",
];

// ── 농구 경험 옵션 ───────────────────────────────────────────────────────────
const EXP_OPTIONS = [
    { value: "없음", label: "없음 (처음이에요)" },
    { value: "1년 미만", label: "1년 미만" },
    { value: "1~3년", label: "1~3년" },
    { value: "3년 이상", label: "3년 이상" },
];

// ── 가입 경로 옵션 ───────────────────────────────────────────────────────────
const SOURCE_OPTIONS = [
    { value: "WEBSITE", label: "홈페이지 검색" },
    { value: "NAVER", label: "네이버" },
    { value: "REFERRAL", label: "지인 소개" },
    { value: "FLYER", label: "전단지" },
    { value: "PASSBY", label: "지나가다" },
    { value: "OTHER", label: "기타" },
];

// ── 요일 순서 ────────────────────────────────────────────────────────────────
const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LABELS: Record<string, string> = {
    Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};

// ── 폼 데이터 타입 ───────────────────────────────────────────────────────────
interface FormData {
    childName: string;
    childBirthDate: string;
    childGrade: string;
    childGender: string;
    basketballExp: string;
    parentName: string;
    parentPhone: string;
    preferredSlotKey: string;
    hopeNote: string;
    source: string;
    agreedTerms: boolean;
    agreedPrivacy: boolean;
    honeypot: string;
}

const INITIAL_FORM: FormData = {
    childName: "",
    childBirthDate: "",
    childGrade: "",
    childGender: "",
    basketballExp: "",
    parentName: "",
    parentPhone: "",
    preferredSlotKey: "",
    hopeNote: "",
    source: "WEBSITE",
    agreedTerms: false,
    agreedPrivacy: false,
    honeypot: "",
};

export default function TrialApplicationForm({ availableSlots, contactPhone }: Props) {
    const [step, setStep] = useState(1);          // 현재 스텝 (1~3)
    const [form, setForm] = useState<FormData>(INITIAL_FORM);
    const [error, setError] = useState("");
    const [completed, setCompleted] = useState(false);  // 제출 완료 여부
    const [isPending, startTransition] = useTransition();

    // 폼 필드 변경 핸들러
    const update = (field: keyof FormData, value: string | boolean) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setError("");
    };

    // ── Step 1 유효성 검사 ───────────────────────────────────────────────────
    const validateStep1 = (): boolean => {
        if (!form.childName.trim()) { setError("아이 이름을 입력해주세요."); return false; }
        if (!form.childBirthDate) { setError("아이 생년월일을 선택해주세요."); return false; }
        if (!form.childGrade) { setError("학년을 선택해주세요."); return false; }
        if (!form.basketballExp) { setError("농구 경험을 선택해주세요."); return false; }
        return true;
    };

    // ── Step 2 유효성 검사 ───────────────────────────────────────────────────
    const validateStep2 = (): boolean => {
        if (!form.parentName.trim()) { setError("보호자 이름을 입력해주세요."); return false; }
        if (!form.parentPhone.trim()) { setError("보호자 연락처를 입력해주세요."); return false; }
        // 전화번호 형식 체크 (10~11자리 숫자)
        const digits = form.parentPhone.replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 11) {
            setError("올바른 전화번호를 입력해주세요. (예: 010-1234-5678)");
            return false;
        }
        return true;
    };

    // ── 다음 단계 ────────────────────────────────────────────────────────────
    const goNext = () => {
        if (step === 1 && !validateStep1()) return;
        if (step === 2 && !validateStep2()) return;
        setError("");
        setStep((s) => Math.min(s + 1, 3));
        // 스크롤 최상단으로 (모바일 UX)
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // ── 이전 단계 ────────────────────────────────────────────────────────────
    const goBack = () => {
        setError("");
        setStep((s) => Math.max(s - 1, 1));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // ── 제출 ─────────────────────────────────────────────────────────────────
    const handleSubmit = () => {
        if (!form.agreedTerms || !form.agreedPrivacy) {
            setError("이용약관과 개인정보 수집/이용에 모두 동의해주세요.");
            return;
        }
        startTransition(async () => {
            try {
                await submitTrialApplication(form);
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
                {/* 성공 아이콘 */}
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-green-600 text-4xl">check_circle</span>
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-3">체험수업 신청 완료!</h2>
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

    // ── 슬롯을 요일별로 그룹핑 ───────────────────────────────────────────────
    const slotsByDay = DAY_ORDER.reduce<Record<string, AvailableSlot[]>>((acc, day) => {
        const daySlots = availableSlots.filter((s) => s.dayOfWeek === day);
        if (daySlots.length > 0) acc[day] = daySlots;
        return acc;
    }, {});

    return (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* 진행 표시줄 — 3단계 */}
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between max-w-sm mx-auto">
                    {[1, 2, 3].map((n) => (
                        <div key={n} className="flex items-center">
                            {/* 스텝 번호 원형 */}
                            <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                                    n < step
                                        ? "bg-green-500 text-white"         // 완료된 스텝
                                        : n === step
                                        ? "bg-brand-orange-500 text-white"  // 현재 스텝
                                        : "bg-gray-200 text-gray-400"       // 미래 스텝
                                }`}
                            >
                                {n < step ? (
                                    <span className="material-symbols-outlined text-lg">check</span>
                                ) : (
                                    n
                                )}
                            </div>
                            {/* 스텝 이름 */}
                            <span className={`ml-2 text-xs font-medium hidden sm:inline ${
                                n === step ? "text-gray-900" : "text-gray-400"
                            }`}>
                                {n === 1 ? "아이 정보" : n === 2 ? "보호자/수업" : "동의/제출"}
                            </span>
                            {/* 연결선 */}
                            {n < 3 && (
                                <div className={`w-8 sm:w-12 h-0.5 mx-2 ${
                                    n < step ? "bg-green-500" : "bg-gray-200"
                                }`} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

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

                        {/* 아이 이름 */}
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

                        {/* 생년월일 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                생년월일 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={form.childBirthDate}
                                onChange={(e) => update("childBirthDate", e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500/50 focus:border-brand-orange-500 outline-none transition-colors text-gray-900"
                            />
                        </div>

                        {/* 학년 */}
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

                        {/* 성별 — 선택사항 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">성별</label>
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

                        {/* 농구 경험 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                농구 경험 <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {EXP_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => update("basketballExp", opt.value)}
                                        className={`py-3 px-3 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
                                            form.basketballExp === opt.value
                                                ? "border-brand-orange-500 bg-brand-orange-50 text-brand-orange-600"
                                                : "border-gray-300 text-gray-600 hover:border-gray-400"
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ──────────── Step 2: 보호자 + 희망 수업 ──────────── */}
                {step === 2 && (
                    <div className="space-y-5">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span className="material-symbols-outlined text-brand-orange-500">person</span>
                            보호자 정보 / 희망 수업
                        </h2>

                        {/* 보호자 이름 */}
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

                        {/* 보호자 연락처 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                보호자 연락처 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="tel"
                                value={form.parentPhone}
                                onChange={(e) => update("parentPhone", e.target.value)}
                                placeholder="010-1234-5678"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500/50 focus:border-brand-orange-500 outline-none transition-colors text-gray-900"
                            />
                        </div>

                        {/* 희망 체험 일정 — 시간표 그리드 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                희망 체험 일정 <span className="text-gray-400 text-xs font-normal">(선택)</span>
                            </label>
                            {Object.keys(slotsByDay).length > 0 ? (
                                <div className="space-y-3">
                                    {DAY_ORDER.filter((d) => slotsByDay[d]).map((day) => (
                                        <div key={day}>
                                            {/* 요일 헤더 */}
                                            <p className="text-xs font-bold text-gray-500 mb-1.5 uppercase">
                                                {DAY_LABELS[day]}요일
                                            </p>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {slotsByDay[day]!.map((slot) => {
                                                    const isFull = slot.available <= 0;
                                                    const isSelected = form.preferredSlotKey === slot.slotKey;
                                                    return (
                                                        <button
                                                            key={slot.slotKey}
                                                            type="button"
                                                            disabled={isFull}
                                                            onClick={() =>
                                                                update(
                                                                    "preferredSlotKey",
                                                                    isSelected ? "" : slot.slotKey
                                                                )
                                                            }
                                                            className={`py-2.5 px-3 rounded-xl border text-xs font-medium transition-colors ${
                                                                isFull
                                                                    ? "border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed"
                                                                    : isSelected
                                                                    ? "border-brand-orange-500 bg-brand-orange-50 text-brand-orange-600 ring-2 ring-brand-orange-500/30"
                                                                    : "border-gray-300 text-gray-700 hover:border-brand-navy-400 cursor-pointer"
                                                            }`}
                                                        >
                                                            {/* 시간 표시 */}
                                                            <span className="block font-semibold text-sm">
                                                                {slot.startTime}~{slot.endTime}
                                                            </span>
                                                            {/* 수업명 */}
                                                            <span className="block mt-0.5 truncate">{slot.className}</span>
                                                            {/* 잔여 석 표시 */}
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

                        {/* 바라는 점 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                바라는 점 <span className="text-gray-400 text-xs font-normal">(선택)</span>
                            </label>
                            <textarea
                                value={form.hopeNote}
                                onChange={(e) => update("hopeNote", e.target.value)}
                                placeholder="궁금하신 점이나 바라는 점을 자유롭게 적어주세요"
                                rows={3}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500/50 focus:border-brand-orange-500 outline-none transition-colors text-gray-900 resize-none"
                            />
                        </div>

                        {/* 가입 경로 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">어떻게 알게 되셨나요?</label>
                            <select
                                value={form.source}
                                onChange={(e) => update("source", e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500/50 focus:border-brand-orange-500 outline-none transition-colors text-gray-900 bg-white"
                            >
                                {SOURCE_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                {/* ──────────── Step 3: 동의 + 제출 ──────────── */}
                {step === 3 && (
                    <div className="space-y-5">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span className="material-symbols-outlined text-brand-orange-500">verified</span>
                            약관 동의 및 제출
                        </h2>

                        {/* 입력 정보 요약 — 제출 전 확인용 */}
                        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                            <h3 className="font-semibold text-gray-900 mb-2">입력 정보 확인</h3>
                            <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
                                <span className="text-gray-500">아이 이름</span>
                                <span className="text-gray-900 font-medium">{form.childName}</span>
                                <span className="text-gray-500">생년월일</span>
                                <span className="text-gray-900">{form.childBirthDate}</span>
                                <span className="text-gray-500">학년</span>
                                <span className="text-gray-900">{form.childGrade}</span>
                                <span className="text-gray-500">농구 경험</span>
                                <span className="text-gray-900">{form.basketballExp}</span>
                                <span className="text-gray-500">보호자</span>
                                <span className="text-gray-900 font-medium">{form.parentName}</span>
                                <span className="text-gray-500">연락처</span>
                                <span className="text-gray-900">{form.parentPhone}</span>
                                {form.preferredSlotKey && (
                                    <>
                                        <span className="text-gray-500">희망 수업</span>
                                        <span className="text-gray-900">{form.preferredSlotKey}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* 이용약관 동의 */}
                        <TermsAccordion
                            title="이용약관 동의"
                            required
                            checked={form.agreedTerms}
                            onCheck={(v) => update("agreedTerms", v)}
                        >
                            <TermsContent />
                        </TermsAccordion>

                        {/* 개인정보 수집/이용 동의 */}
                        <TermsAccordion
                            title="개인정보 수집/이용 동의"
                            required
                            checked={form.agreedPrivacy}
                            onCheck={(v) => update("agreedPrivacy", v)}
                        >
                            <PrivacyContent />
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
                    {/* 이전 버튼 */}
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
                        <div /> /* 빈 공간 — 다음 버튼을 오른쪽 정렬 유지 */
                    )}

                    {/* 다음 / 제출 버튼 */}
                    {step < 3 ? (
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
                                    <span className="material-symbols-outlined text-lg">sports_basketball</span>
                                    체험수업 신청하기
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── 약관 아코디언 컴포넌트 ────────────────────────────────────────────────────
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
            {/* 헤더 — 체크박스 + 제목 + 펼치기/접기 */}
            <div className="flex items-center px-4 py-3 bg-gray-50">
                {/* 동의 체크박스 */}
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
                {/* 접기/펼치기 버튼 */}
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
            {/* 약관 본문 — 펼쳐져 있을 때만 표시 */}
            {isOpen && (
                <div className="px-4 py-3 border-t border-gray-100 max-h-48 overflow-y-auto text-xs text-gray-600 leading-relaxed">
                    {children}
                </div>
            )}
        </div>
    );
}

// ── 이용약관 내용 ─────────────────────────────────────────────────────────────
function TermsContent() {
    return (
        <div className="space-y-2">
            <p className="font-semibold text-gray-800">STIZ 농구교실 이용약관</p>
            <p>1. 체험수업은 1회 1만원의 체험비가 있습니다.</p>
            <p>2. 체험수업 시 운동복과 실내화를 반드시 준비해주세요.</p>
            <p>3. 수업 중 안전사고에 대비하여 코치의 안전 지시를 따라주세요.</p>
            <p>4. 체험수업 후 정규 등록 시 체험비는 첫 달 수강료에서 차감됩니다.</p>
            <p>5. 체험수업 일정은 사전 협의 후 확정되며, 당일 취소 시 체험비 환불이 불가합니다.</p>
            <p>6. 학원 내 분실물에 대해 학원은 책임지지 않습니다.</p>
        </div>
    );
}

// ── 개인정보 수집/이용 동의 내용 ──────────────────────────────────────────────
function PrivacyContent() {
    return (
        <div className="space-y-2">
            <p className="font-semibold text-gray-800">개인정보 수집/이용 동의</p>
            <p><strong>수집 항목:</strong> 아이 이름, 생년월일, 학년, 성별, 보호자 이름, 연락처</p>
            <p><strong>수집 목적:</strong> 체험수업 신청 접수, 일정 안내, 수업 배정</p>
            <p><strong>보유 기간:</strong> 체험수업 종료 후 6개월 (미등록 시) 또는 정규 등록 시 회원 탈퇴 시까지</p>
            <p><strong>동의 거부 권리:</strong> 동의를 거부할 수 있으나, 동의하지 않을 경우 체험수업 신청이 불가합니다.</p>
            <p>수집된 개인정보는 목적 외 용도로 사용되지 않으며, 제3자에게 제공되지 않습니다.</p>
        </div>
    );
}
