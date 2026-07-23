"use client";

/**
 * ?섍컯 ?좎껌 ????4?④퀎 ?ㅽ뀦 ??(紐⑤컮???쇱뒪??
 *
 * Step 1: ?꾩씠 ?뺣낫 (?대쫫, ?깅퀎, ?앸뀈?붿씪, ?숈깮 ?꾪솕踰덊샇, ?숆탳紐?
 * Step 2: 蹂댄샇???뺣낫 (?대쫫, ?곕씫泥? 二쇱냼)
 * Step 3: ?섍컯 ?뺣낫 (?섍컯 ?? ?щ쭩 ?섏뾽, ?뷀?, 媛?낃꼍濡? ?붿껌?ы빆)
 * Step 4: ?뺤씤 + ?숈쓽 (?낅젰 ?뺣낫 ?붿빟, ?댁슜?쎄?, 媛쒖씤?뺣낫 ?숈쓽, honeypot)
 *
 * trialData媛 ?덉쑝硫?泥댄뿕 ?곗씠?곕? ?먮룞 梨꾩? (?섏젙 媛??
 */

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import {
    findExistingEnrollApplicationForEdit,
    submitEnrollApplication,
    type AvailableSlot,
    type TrialLeadForEnroll,
} from "@/app/actions/public";
import Link from "next/link";
import { trackMetaEvent } from "@/components/MetaPixel";
import FontFreeIcon from "@/components/ui/FontFreeIcon";

const EnrollApplicationLaterSteps = dynamic(() => import("./EnrollApplicationLaterSteps"), {
    loading: () => (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
            ?ㅼ쓬 ?④퀎瑜?遺덈윭?ㅻ뒗 以?..
        </div>
    ),
});

// ?? Props ??????????????????????????????????????????????????????????????????
interface Props {
    availableSlots: AvailableSlot[];
    contactPhone: string;
    trialData: TrialLeadForEnroll | null;
    accessCode: string | null;
}

interface AccountHandoff {
    token: string;
    next: string;
    parentName: string;
    parentPhone: string;
    alreadyLinked?: boolean;
}

// ?? ???곗씠???????????????????????????????????????????????????????????????
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
    enrollmentMonths: string[];
    preferredSlotKeys: string[];  // 蹂듭닔 ?좏깮 媛??["Mon-4", "Wed-6"]
    basketballExp: string;        // ?띻뎄 寃쏀뿕
    shuttleChoice: string;        // "?묒듅" | "誘명깙??
    shuttleNeeded: boolean;
    shuttlePickup: string;
    shuttleTime: string;          // ?뷀? ?щ쭩 ?쒓컙
    shuttleDropoff: string;       // ?뷀? ?섏감 ?μ냼
    referralSource: string;
    memo: string;
    agreedTerms: boolean;
    agreedPrivacy: boolean;
    applicationNoticeConfirmed: boolean;
    shuttleNoticeConfirmed: boolean;
    honeypot: string;
}

// ?? ?ㅽ뀦 ?쇰꺼 (4?④퀎) ???????????????????????????????????????????????????????
const STEP_LABELS = ["아이 정보", "보호자", "수강 정보", "확인/동의"];
const TOTAL_STEPS = 4;

export default function EnrollApplicationForm({
    availableSlots,
    contactPhone,
    trialData,
    accessCode,
}: Props) {
    // 泥댄뿕 ?곗씠?곌? ?덉쑝硫?珥덇린媛믪쑝濡?梨꾩? (?ъ슜?먭? ?섏젙 媛??
    const preferredTrialSlot = trialData?.preferredSlotKey && availableSlots.some((slot) => slot.slotKey === trialData.preferredSlotKey)
        ? trialData.preferredSlotKey
        : "";
    const trialChildPhone = trialData?.childPhone || trialData?.parentPhone || "";
    const [step, setStep] = useState(1);
    const [form, setForm] = useState<FormData>({
        childName: trialData?.childName || "",
        childBirthDate: trialData?.childBirthDate || "",
        childGender: trialData?.childGender || "",
        childGrade: trialData?.childGrade || "",
        childSchool: trialData?.childSchool || "",
        childPhone: trialChildPhone,
        parentName: trialData?.parentName || "",
        parentPhone: trialData?.parentPhone || "",
        parentRelation: "",
        address: "",
        enrollmentMonths: [],
        preferredSlotKeys: preferredTrialSlot ? [preferredTrialSlot] : [],
        basketballExp: trialData?.basketballExp || "",
        shuttleChoice: "",
        shuttleNeeded: false,
        shuttlePickup: "",
        shuttleTime: "",
        shuttleDropoff: "",
        referralSource: trialData?.source || "",
        memo: "",
        agreedTerms: false,
        agreedPrivacy: false,
        applicationNoticeConfirmed: false,
        shuttleNoticeConfirmed: false,
        honeypot: "",
    });
    const [error, setError] = useState("");
    const [completed, setCompleted] = useState(false);
    const [existingApplicationId, setExistingApplicationId] = useState<string | null>(null);
    const [existingNotice, setExistingNotice] = useState("");
    const [completionMode, setCompletionMode] = useState<"created" | "updated" | "existing">("created");
    const [accountHandoff, setAccountHandoff] = useState<AccountHandoff | null>(null);
    const [isPending, startTransition] = useTransition();

    const update = (field: keyof FormData, value: string | boolean | string[]) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setError("");
    };

    // ?? Step 1 ?좏슚??寃?? ?꾩씠 ?뺣낫 ???????????????????????????????????????
    const validateStep1 = (): boolean => {
        if (!form.childName.trim()) { setError("?꾩씠 ?대쫫???낅젰?댁＜?몄슂."); return false; }
        if (!form.childBirthDate) { setError("?꾩씠 ?앸뀈?붿씪???좏깮?댁＜?몄슂."); return false; }
        if (!form.childGender) { setError("?깅퀎???좏깮?댁＜?몄슂."); return false; }
        if (!form.childSchool.trim()) { setError("?숆탳紐낆쓣 ?낅젰?댁＜?몄슂."); return false; }
        if (!form.childPhone.trim()) { setError("?섍컯???꾪솕踰덊샇瑜??낅젰?댁＜?몄슂."); return false; }
        return true;
    };

    // ?? Step 2 ?좏슚??寃?? 蹂댄샇???뺣낫 ?????????????????????????????????????
    const validateStep2 = (): boolean => {
        if (!form.parentName.trim()) { setError("蹂댄샇???대쫫???낅젰?댁＜?몄슂."); return false; }
        if (!form.parentPhone.trim()) { setError("蹂댄샇???곕씫泥섎? ?낅젰?댁＜?몄슂."); return false; }
        const digits = form.parentPhone.replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 11) {
            setError("?щ컮瑜??꾪솕踰덊샇瑜??낅젰?댁＜?몄슂. (?? 010-1234-5678)");
            return false;
        }
        return true;
    };

    // ?? Step 3 ?좏슚??寃?? ?섍컯 ?뺣낫 ???????????????????????????????????????
    const validateStep3 = (): boolean => {
        if (form.enrollmentMonths.length === 0) { setError("?섍컯?좎껌 ?붿쓣 ?좏깮?댁＜?몄슂."); return false; }
        if (!form.referralSource) { setError("媛?낃꼍濡쒕? ?좏깮?댁＜?몄슂."); return false; }
        if (!form.shuttleChoice) { setError("?뷀??묒듅 ?щ?瑜??좏깮?댁＜?몄슂."); return false; }
        if (form.shuttleChoice === "탑승") {
            if (!form.shuttlePickup.trim()) { setError("?뷀? ?묒듅 ?μ냼瑜??낅젰?댁＜?몄슂."); return false; }
            if (!form.shuttleTime) { setError("?뷀? ?щ쭩 ?쒓컙???낅젰?댁＜?몄슂."); return false; }
            if (!form.shuttleDropoff.trim()) { setError("?뷀? ?섏감 ?μ냼瑜??낅젰?댁＜?몄슂."); return false; }
            if (!form.shuttleNoticeConfirmed) { setError("?뷀? 二쇱쓽?ы빆???뺤씤?댁＜?몄슂."); return false; }
        }
        return true;
    };

    // ?? ?ㅼ쓬 ?④퀎 ????????????????????????????????????????????????????????????
    const loadExistingApplication = async () => {
        const existing = await findExistingEnrollApplicationForEdit({
            accessCode,
            childName: form.childName,
            childBirthDate: form.childBirthDate,
            parentPhone: form.parentPhone,
        });
        if (!existing || existing.id === existingApplicationId) return;

        setExistingApplicationId(existing.id);
        if (existing.editable) {
            setForm((prev) => ({
                ...prev,
                childName: existing.childName || prev.childName,
                childBirthDate: existing.childBirthDate || prev.childBirthDate,
                childGender: existing.childGender || prev.childGender,
                childGrade: existing.childGrade || prev.childGrade,
                childSchool: existing.childSchool || prev.childSchool,
                childPhone: existing.childPhone || prev.childPhone,
                parentName: existing.parentName || prev.parentName,
                parentPhone: existing.parentPhone || prev.parentPhone,
                parentRelation: existing.parentRelation || prev.parentRelation,
                address: existing.address || prev.address,
                enrollmentMonths: existing.enrollmentMonths.length > 0 ? existing.enrollmentMonths : prev.enrollmentMonths,
                preferredSlotKeys: existing.preferredSlotKeys.length > 0 ? existing.preferredSlotKeys : prev.preferredSlotKeys,
                basketballExp: existing.basketballExp || prev.basketballExp,
                shuttleChoice: existing.shuttleNeeded ? "탑승" : "미탑승",
                shuttleNeeded: existing.shuttleNeeded,
                shuttlePickup: existing.shuttlePickup || prev.shuttlePickup,
                shuttleTime: existing.shuttleTime || prev.shuttleTime,
                shuttleDropoff: existing.shuttleDropoff || prev.shuttleDropoff,
                referralSource: existing.referralSource || prev.referralSource,
                memo: existing.memo || prev.memo,
            }));
            setExistingNotice("기존 수강신청서를 불러왔습니다. 필요한 부분만 수정해서 다시 제출해주세요.");
        } else {
            setExistingNotice("이미 승인된 수강신청서가 있습니다. 변경이 필요하면 학원으로 문의해주세요.");
        }
    };

    const goNext = async () => {
        if (step === 1 && !validateStep1()) return;
        if (step === 2 && !validateStep2()) return;
        if (step === 3 && !validateStep3()) return;
        if (step === 2) await loadExistingApplication();
        setError("");
        setStep((s) => Math.min(s + 1, TOTAL_STEPS));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // ?? ?댁쟾 ?④퀎 ????????????????????????????????????????????????????????????
    const goBack = () => {
        setError("");
        setStep((s) => Math.max(s - 1, 1));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // ?? ?щ’ ?좏깮 ?좉? (蹂듭닔 ?좏깮 媛?? ?????????????????????????????????????
    const toggleSlot = (slotKey: string) => {
        const keys = form.preferredSlotKeys;
        if (keys.includes(slotKey)) {
            update("preferredSlotKeys", keys.filter((k) => k !== slotKey));
        } else {
            update("preferredSlotKeys", [...keys, slotKey]);
        }
    };

    // ?? ?쒖텧 ?????????????????????????????????????????????????????????????????
    const handleSubmit = () => {
        if (!form.agreedTerms || !form.agreedPrivacy) {
            setError("?댁슜?쎄?怨?媛쒖씤?뺣낫 ?섏쭛/?댁슜??紐⑤몢 ?숈쓽?댁＜?몄슂.");
            return;
        }
        if (!form.applicationNoticeConfirmed) {
            setError("?섍컯?좎껌?뺤젙 ?덈궡瑜??뺤씤?댁＜?몄슂.");
            return;
        }
        startTransition(async () => {
            try {
                const result = await submitEnrollApplication({
                    existingId: existingApplicationId || undefined,
                    accessCode: accessCode || undefined,
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
                    enrollmentMonths: form.enrollmentMonths.join(",") || undefined,
                    preferredSlotKeys: form.preferredSlotKeys.join(",") || undefined,
                    basketballExp: form.basketballExp || undefined,
                    shuttleNeeded: form.shuttleChoice === "탑승",
                    shuttlePickup: form.shuttlePickup || undefined,
                    shuttleTime: form.shuttleTime || undefined,
                    shuttleDropoff: form.shuttleDropoff || undefined,
                    referralSource: form.referralSource || undefined,
                    memo: form.memo || undefined,
                    agreedTerms: form.agreedTerms,
                    agreedPrivacy: form.agreedPrivacy,
                    applicationNoticeConfirmed: form.applicationNoticeConfirmed,
                    shuttleNoticeConfirmed: form.shuttleNoticeConfirmed,
                    honeypot: form.honeypot,
                });
                setCompletionMode(result.mode === "updated" ? "updated" : result.mode === "existing" ? "existing" : "created");
                setAccountHandoff(
                    "accountHandoff" in result && result.accountHandoff
                        ? result.accountHandoff as AccountHandoff
                        : null,
                );
                trackMetaEvent("CompleteRegistration", {
                    content_name: "Enrollment application",
                    content_category: "Application",
                });
                setCompleted(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "?좎껌 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.");
            }
        });
    };

    const signupHref = accountHandoff
        ? `${accountHandoff.next}${accountHandoff.next.includes("?") ? "&" : "?"}${new URLSearchParams({
            name: accountHandoff.parentName,
            phone: accountHandoff.parentPhone,
            enrollmentHandoff: accountHandoff.token,
        }).toString()}`
        : "/signup/parent";
    const loginHref = accountHandoff
        ? `/login?${new URLSearchParams({
            redirect: "/parent",
            enrollmentHandoff: accountHandoff.token,
        }).toString()}`
        : "/login";

    // ?? ?꾨즺 ?붾㈃ ????????????????????????????????????????????????????????????
    if (completed) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
                    <FontFreeIcon name="check_circle" size={40} className="text-green-600" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3">
                    {completionMode === "updated"
                        ? "수강신청서 수정 완료!"
                        : completionMode === "existing"
                        ? "이미 접수된 수강신청서가 있습니다"
                        : "수강신청 완료!"}
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-2">?대떦?먭? 鍮좊Ⅸ ?쒓컙 ?댁뿉 ?곕씫?쒕━寃좎뒿?덈떎.</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                    臾몄쓽?ы빆???덉쑝?쒕㈃{" "}
                    <a href={`tel:${contactPhone.replace(/-/g, "")}`} className="text-brand-orange-500 dark:text-brand-neon-lime font-semibold">
                        {contactPhone}
                    </a>
                    ?쇰줈 ?꾪솕?댁＜?몄슂.
                </p>
                {accountHandoff && !accountHandoff.alreadyLinked && (
                    <div className="mb-6 rounded-2xl border border-brand-orange-200 bg-orange-50 p-5 text-left dark:border-brand-neon-lime/30 dark:bg-brand-neon-lime/10">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined shrink-0 text-[28px] text-brand-orange-500 dark:text-brand-neon-lime" aria-hidden="true">
                                account_circle
                            </span>
                            <div>
                                <h3 className="font-black text-brand-navy-900 dark:text-white">이어서 학부모 계정을 연결해주세요</h3>
                                <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
                                    계정을 연결하면 방금 제출한 신청서를 바로 확인할 수 있습니다. 가입하지 않아도 수강신청은 이미 정상 접수되었습니다.
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            <Link
                                href={signupHref}
                                className="flex min-h-12 items-center justify-center rounded-xl bg-brand-orange-500 px-4 text-center font-bold text-white hover:bg-brand-orange-600 dark:bg-brand-neon-lime dark:text-brand-navy-900"
                            >
                                처음이에요 · 회원가입
                            </Link>
                            <Link
                                href={loginHref}
                                className="flex min-h-12 items-center justify-center rounded-xl border border-gray-300 bg-white px-4 text-center font-bold text-brand-navy-900 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            >
                                계정이 있어요 · 로그인
                            </Link>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-gray-500 dark:text-gray-400">
                            신청서의 보호자 휴대전화와 가입 시 인증한 번호가 일치해야 자동으로 연결됩니다.
                        </p>
                    </div>
                )}
                {accountHandoff?.alreadyLinked && (
                    <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200">
                        현재 로그인한 학부모 계정에 신청서가 연결되었습니다.
                    </div>
                )}
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-brand-navy-900 text-white rounded-xl font-medium hover:bg-brand-navy-800 transition-colors"
                >
                    <FontFreeIcon name="home" size={18} />
                    ?덉쑝濡??뚯븘媛湲?                </Link>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
            {/* 吏꾪뻾 ?쒖떆以???4?④퀎 */}
            <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between max-w-md mx-auto">
                    {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
                        <div key={n} className="flex items-center">
                            {/* ?ㅽ뀦 踰덊샇 ?먰삎 ???꾨즺/?꾩옱/誘몃옒 ?됱긽 遺꾧린 */}
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
                                    <FontFreeIcon name="check" size={18} />
                                ) : (
                                    n
                                )}
                            </div>
                            {/* ?ㅽ뀦 ?대쫫 ??紐⑤컮?쇱뿉?쒕뒗 ?④? */}
                            <span className={`ml-1.5 text-xs font-medium hidden sm:inline ${
                                n === step ? "text-gray-900 dark:text-white" : "text-gray-400"
                            }`}>
                                {STEP_LABELS[n - 1]}
                            </span>
                            {/* ?곌껐??*/}
                            {n < TOTAL_STEPS && (
                                <div className={`w-6 sm:w-8 h-0.5 mx-1.5 ${
                                    n < step ? "bg-green-500" : "bg-gray-200"
                                }`} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* 泥댄뿕 ?곗씠???먮룞 梨꾩? ?뚮┝ 諛곕꼫 */}
            {trialData && step === 1 && (
                <div className="mx-6 mt-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm flex items-center gap-2">
                    <FontFreeIcon name="auto_fix_high" size={18} />
                    泥댄뿕?섏뾽 ?뺣낫媛 ?먮룞?쇰줈 ?낅젰?섏뿀?듬땲?? ?꾩슂?섎㈃ ?섏젙?????덉뒿?덈떎.
                </div>
            )}

            {/* ??蹂몃Ц */}
            <div className="p-6">
                {/* ?먮윭 硫붿떆吏 */}
                {error && (
                    <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                        <FontFreeIcon name="error" size={18} />
                        {error}
                    </div>
                )}
                {existingNotice && (
                    <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-sm font-semibold flex items-center gap-2 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-100">
                        <FontFreeIcon name="edit" size={18} />
                        {existingNotice}
                    </div>
                )}

                {/* ???????????? Step 1: ?꾩씠 ?뺣낫 ???????????? */}
                {step === 1 && (
                    <div className="space-y-5">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <FontFreeIcon name="child_care" size={20} className="text-brand-orange-500 dark:text-brand-neon-lime" />
                            ?꾩씠 ?뺣낫
                        </h2>

                        {/* ?꾩씠 ?대쫫 (?꾩닔) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                ?꾩씠 ?대쫫 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.childName}
                                onChange={(e) => update("childName", e.target.value)}
                                placeholder="홍길동"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* ?앸뀈?붿씪 (?꾩닔) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                ?앸뀈?붿씪 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                min="1950-01-01" max="2025-12-31"
                                value={form.childBirthDate}
                                onChange={(e) => update("childBirthDate", e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* ?깅퀎 (?꾩닔) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                ?깅퀎 <span className="text-red-500">*</span>
                            </label>
                            <div className="flex gap-3">
                                {["?⑥옄", "?ъ옄"].map((g) => (
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

                        {/* ?숆탳紐?(?꾩닔) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                ?숆탳紐?<span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.childSchool}
                                onChange={(e) => update("childSchool", e.target.value)}
                                placeholder="?ㅼ궛珥덈벑?숆탳"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* ?섍컯???꾪솕踰덊샇 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                ?섍컯???꾪솕踰덊샇(?レ옄留? <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="tel"
                                value={form.childPhone}
                                onChange={(e) => {
                                    const nums = e.target.value.replace(/\D/g, "").slice(0, 11);
                                    let formatted = nums;
                                    if (nums.length > 7) formatted = `${nums.slice(0,3)}-${nums.slice(3,7)}-${nums.slice(7)}`;
                                    else if (nums.length > 3) formatted = `${nums.slice(0,3)}-${nums.slice(3)}`;
                                    update("childPhone", formatted);
                                }}
                                placeholder="?レ옄留??낅젰 (?먮룞 蹂?? 010-1234-5678)"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white"
                            />
                            <p className="text-xs text-gray-400 mt-1">?レ옄留??낅젰?섎㈃ ?먮룞?쇰줈 000-0000-0000 ?뺤떇?쇰줈 蹂?섎맗?덈떎</p>
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
                {/* ?? ?ㅻ퉬寃뚯씠??踰꾪듉 ??????????????????????????????????????????? */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
                    {step > 1 ? (
                        <button
                            type="button"
                            onClick={goBack}
                            className="flex items-center gap-1 px-5 py-3 text-gray-600 hover:text-gray-900 dark:text-white font-medium transition-colors cursor-pointer"
                        >
                            <FontFreeIcon name="arrow_back" size={18} />
                            ?댁쟾
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
                            ?ㅼ쓬
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
                                    泥섎━ 以?..
                                </>
                            ) : (
                                <>
                                    <FontFreeIcon name="how_to_reg" size={18} />
                                    ?섍컯 ?좎껌?섍린
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
