"use client";

/**
 * 체험수업 신청 폼 — 3단계 스텝 폼 (모바일 퍼스트)
 *
 * Step 1: 체험 일정 (희망일, 요일, 교시)
 * Step 2: 아이/보호자 정보 (이름, 성별, 학교, 학년, 연락처, 신청경로)
 * Step 3: 비용 확인 + 제출 (체험비 확인, honeypot)
 */

import { useState, useTransition } from "react";
import { submitTrialApplication, type AvailableSlot } from "@/app/actions/public";
import Link from "next/link";
import { trackMetaEvent } from "@/components/MetaPixel";
import FontFreeIcon from "@/components/ui/FontFreeIcon";

// ── Props 타입 ───────────────────────────────────────────────────────────────
interface Props {
    availableSlots: AvailableSlot[];
    contactPhone: string;
}

// ── 학년 옵션 ────────────────────────────────────────────────────────────────
const GRADE_OPTIONS = [
    "6세", "7세", "초1", "초2", "초3", "초4", "초5", "초6",
    "중1", "중2", "중3", "고1", "고2", "고3", "성인",
];

// ── 신청 경로 옵션 — Google Form과 동일 ─────────────────────────────────────
const SOURCE_OPTIONS = [
    { value: "NAVER_SEARCH", label: "네이버 키워드 검색" },
    { value: "PORTAL_OTHER", label: "네이버 외 포털검색" },
    { value: "NAVER_BLOG", label: "스티즈 네이버블로그" },
    { value: "INSTAGRAM", label: "인스타그램" },
    { value: "YOUTUBE", label: "유튜브" },
    { value: "PASSBY", label: "지나가다발견" },
    { value: "REFERRAL", label: "지인소개" },
    { value: "SOOMGO", label: "숨고" },
    { value: "DANGGEUN", label: "당근마켓" },
    { value: "OTHER", label: "기타" },
];

const TRIAL_DAY_OPTIONS = ["월", "화", "수", "목", "금", "토"];
const TRIAL_PERIOD_OPTIONS = ["1", "2", "3", "4", "5", "6", "7", "8"];

// ── 폼 데이터 타입 ───────────────────────────────────────────────────────────
interface FormData {
    trialDate: string;
    trialDay: string;
    trialPeriod: string;
    childName: string;
    childGrade: string;
    childGender: string;
    childSchool: string;
    parentPhone: string;
    source: string;
    trialFeeConfirmed: boolean;
    honeypot: string;
}

const INITIAL_FORM: FormData = {
    trialDate: "",
    trialDay: "",
    trialPeriod: "",
    childName: "",
    childGrade: "",
    childGender: "",
    childSchool: "",
    parentPhone: "",
    source: "",
    trialFeeConfirmed: false,
    honeypot: "",
};

export default function TrialApplicationForm({ contactPhone }: Props) {
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
        if (!form.trialDate) { setError("체험수업 희망일을 선택해주세요."); return false; }
        if (!form.trialDay) { setError("요일을 선택해주세요."); return false; }
        if (!form.trialPeriod) { setError("교시를 선택해주세요."); return false; }
        return true;
    };

    // ── Step 2 유효성 검사 ───────────────────────────────────────────────────
    const validateStep2 = (): boolean => {
        if (!form.childName.trim()) { setError("아이 이름을 입력해주세요."); return false; }
        if (!form.childGender) { setError("성별을 선택해주세요."); return false; }
        if (!form.childSchool.trim()) { setError("학교를 입력해주세요."); return false; }
        if (!form.childGrade) { setError("학년을 선택해주세요."); return false; }
        if (!form.parentPhone.trim()) { setError("학부모 연락처를 입력해주세요."); return false; }
        // 전화번호 형식 체크 (10~11자리 숫자)
        const digits = form.parentPhone.replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 11) {
            setError("올바른 전화번호를 입력해주세요. (예: 010-1234-5678)");
            return false;
        }
        if (!form.source) { setError("신청경로를 선택해주세요."); return false; }
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
        if (!form.trialFeeConfirmed) {
            setError("체험수업 비용 확인에 체크해주세요.");
            return;
        }
        startTransition(async () => {
            try {
                await submitTrialApplication(form);
                trackMetaEvent("Lead", {
                    content_name: "Trial application",
                    content_category: "Application",
                });
                setCompleted(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "신청 중 오류가 발생했습니다.");
            }
        });
    };

    // ── 완료 화면 ────────────────────────────────────────────────────────────
    if (completed) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
                {/* 성공 아이콘 */}
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
                    <FontFreeIcon name="check_circle" size={40} className="text-green-600" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3">체험수업 신청 완료!</h2>
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
                    <FontFreeIcon name="home" size={18} />
                    홈으로 돌아가기
                </Link>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
            {/* 진행 표시줄 — 3단계 */}
            <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between max-w-sm mx-auto">
                    {[1, 2, 3].map((n) => (
                        <div key={n} className="flex items-center">
                            {/* 스텝 번호 원형 */}
                            <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                                    n < step
                                        ? "bg-green-500 text-white"         // 완료된 스텝
                                        : n === step
                                        ? "bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white"  // 현재 스텝
                                        : "bg-gray-200 text-gray-400"       // 미래 스텝
                                }`}
                            >
                                {n < step ? (
                                    <FontFreeIcon name="check" size={18} />
                                ) : (
                                    n
                                )}
                            </div>
                            {/* 스텝 이름 */}
                            <span className={`ml-2 text-xs font-medium hidden sm:inline ${
                                n === step ? "text-gray-900 dark:text-white" : "text-gray-400"
                            }`}>
                                {n === 1 ? "체험 일정" : n === 2 ? "신청 정보" : "비용 확인"}
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
                        <FontFreeIcon name="error" size={18} />
                        {error}
                    </div>
                )}

                {/* ──────────── Step 1: 체험 일정 ──────────── */}
                {step === 1 && (
                    <div className="space-y-5">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <FontFreeIcon name="calendar_today" size={20} className="text-brand-orange-500 dark:text-brand-neon-lime" />
                            체험 일정
                        </h2>

                        {/* 체험수업 희망일 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                체험수업 희망일 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={form.trialDate}
                                onChange={(e) => update("trialDate", e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* 요일 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                                요일 <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                {TRIAL_DAY_OPTIONS.map((day) => (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => update("trialDay", day)}
                                        className={`py-3 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
                                            form.trialDay === day
                                                ? "border-brand-orange-500 dark:border-brand-neon-lime bg-brand-orange-50 dark:bg-brand-neon-lime/10 text-brand-orange-600 dark:text-brand-neon-lime"
                                                : "border-gray-300 text-gray-600 dark:text-gray-300 hover:border-gray-400"
                                        }`}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 교시 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                                교시 <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {TRIAL_PERIOD_OPTIONS.map((period) => (
                                    <button
                                        key={period}
                                        type="button"
                                        onClick={() => update("trialPeriod", period)}
                                        className={`py-3 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
                                            form.trialPeriod === period
                                                ? "border-brand-orange-500 dark:border-brand-neon-lime bg-brand-orange-50 dark:bg-brand-neon-lime/10 text-brand-orange-600 dark:text-brand-neon-lime"
                                                : "border-gray-300 text-gray-600 dark:text-gray-300 hover:border-gray-400"
                                        }`}
                                    >
                                        {period}교시
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ──────────── Step 2: 보호자 + 희망 수업 ──────────── */}
                {step === 2 && (
                    <div className="space-y-5">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <FontFreeIcon name="child_care" size={20} className="text-brand-orange-500 dark:text-brand-neon-lime" />
                            아이 정보 / 연락처
                        </h2>

                        {/* 아이 이름 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                이름 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.childName}
                                onChange={(e) => update("childName", e.target.value)}
                                placeholder="홍길동"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* 성별 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                성별 <span className="text-red-500">*</span>
                            </label>
                            <div className="flex gap-3">
                                {["남", "여"].map((gender) => (
                                    <button
                                        key={gender}
                                        type="button"
                                        onClick={() => update("childGender", gender)}
                                        className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
                                            form.childGender === gender
                                                ? "border-brand-orange-500 dark:border-brand-neon-lime bg-brand-orange-50 dark:bg-brand-neon-lime/10 text-brand-orange-600 dark:text-brand-neon-lime"
                                                : "border-gray-300 text-gray-600 dark:text-gray-300 hover:border-gray-400"
                                        }`}
                                    >
                                        {gender}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 학교 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                학교 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.childSchool}
                                onChange={(e) => update("childSchool", e.target.value)}
                                placeholder="다산초등학교"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* 학년 */}
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
                                {GRADE_OPTIONS.map((grade) => (
                                    <option key={grade} value={grade}>{grade}</option>
                                ))}
                            </select>
                        </div>

                        {/* 학부모 연락처 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                학부모 연락처 <span className="text-red-500">*</span>
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
                                placeholder="'-'없이 숫자만 입력해주세요"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white"
                            />
                            <p className="text-xs text-gray-400 mt-1">숫자만 입력하면 자동으로 000-0000-0000 형식으로 변환됩니다</p>
                        </div>

                        {/* 신청 경로 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                신청경로 <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={form.source}
                                onChange={(e) => update("source", e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                            >
                                <option value="">선택해주세요</option>
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
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <FontFreeIcon name="verified" size={20} className="text-brand-orange-500 dark:text-brand-neon-lime" />
                            비용 확인 및 제출
                        </h2>

                        {/* 입력 정보 요약 — 제출 전 확인용 */}
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-2 text-sm">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">입력 정보 확인</h3>
                            <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
                                <span className="text-gray-500 dark:text-gray-400">희망일</span>
                                <span className="text-gray-900 dark:text-white">{form.trialDate}</span>
                                <span className="text-gray-500 dark:text-gray-400">요일/교시</span>
                                <span className="text-gray-900 dark:text-white">{form.trialDay}요일 {form.trialPeriod}교시</span>
                                <span className="text-gray-500 dark:text-gray-400">아이 이름</span>
                                <span className="text-gray-900 dark:text-white font-medium">{form.childName}</span>
                                <span className="text-gray-500 dark:text-gray-400">성별</span>
                                <span className="text-gray-900 dark:text-white">{form.childGender}</span>
                                <span className="text-gray-500 dark:text-gray-400">학교</span>
                                <span className="text-gray-900 dark:text-white">{form.childSchool}</span>
                                <span className="text-gray-500 dark:text-gray-400">학년</span>
                                <span className="text-gray-900 dark:text-white">{form.childGrade}</span>
                                <span className="text-gray-500 dark:text-gray-400">연락처</span>
                                <span className="text-gray-900 dark:text-white">{form.parentPhone}</span>
                                <span className="text-gray-500 dark:text-gray-400">신청경로</span>
                                <span className="text-gray-900 dark:text-white">
                                    {SOURCE_OPTIONS.find((option) => option.value === form.source)?.label || form.source}
                                </span>
                            </div>
                        </div>

                        <TermsAccordion
                            title="체험수업 비용 확인"
                            required
                            checked={form.trialFeeConfirmed}
                            onCheck={(v) => update("trialFeeConfirmed", v)}
                        >
                            <TrialFeeContent />
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
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
                    {/* 이전 버튼 */}
                    {step > 1 ? (
                        <button
                            type="button"
                            onClick={goBack}
                            className="flex items-center gap-1 px-5 py-3 text-gray-600 hover:text-gray-900 dark:text-white font-medium transition-colors cursor-pointer"
                        >
                            <FontFreeIcon name="arrow_back" size={18} />
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
                            className="flex items-center gap-1 px-6 py-3 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white rounded-xl font-medium hover:bg-brand-orange-600 dark:hover:bg-lime-400 transition-colors cursor-pointer"
                        >
                            다음
                            <FontFreeIcon name="arrow_forward" size={18} />
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
                                    <FontFreeIcon name="progress_activity" size={18} className="animate-spin" />
                                    처리 중...
                                </>
                            ) : (
                                <>
                                    <FontFreeIcon name="sports_basketball" size={18} />
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
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            {/* 헤더 — 체크박스 + 제목 + 펼치기/접기 */}
            <div className="flex items-center px-4 py-3 bg-gray-50 dark:bg-gray-900">
                {/* 동의 체크박스 */}
                <label className="flex items-center gap-2 flex-1 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => onCheck(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-brand-orange-500 dark:text-brand-neon-lime focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50"
                    />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {title} {required && <span className="text-red-500">*</span>}
                    </span>
                </label>
                {/* 접기/펼치기 버튼 */}
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="text-gray-400 hover:text-gray-600 dark:text-gray-300 p-1 cursor-pointer"
                >
                    <FontFreeIcon name="expand_more" size={18} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
            </div>
            {/* 약관 본문 — 펼쳐져 있을 때만 표시 */}
            {isOpen && (
                <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 max-h-48 overflow-y-auto text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    {children}
                </div>
            )}
        </div>
    );
}

// ── 이용약관 내용 ─────────────────────────────────────────────────────────────
function TrialFeeContent() {
    return (
        <div className="space-y-2">
            <p className="font-semibold text-gray-800 dark:text-gray-100">체험수업 비용 안내</p>
            <p>체험수업 비용은 1만원입니다.</p>
            <p>입금계좌: 카카오뱅크 3333-05-1344817 김수빈</p>
            <p>신청 후 안내문자를 받으셔야 체험수업이 확정됩니다.</p>
        </div>
    );
}
