"use client";

/**
 * 泥댄뿕?섏뾽 ?좎껌 ????3?④퀎 ?ㅽ뀦 ??(紐⑤컮???쇱뒪??
 *
 * Step 1: 泥댄뿕 ?쇱젙 (?щ쭩?? ?붿씪, 援먯떆)
 * Step 2: ?꾩씠/蹂댄샇???뺣낫 (?대쫫, ?깅퀎, ?숆탳, ?숇뀈, ?곕씫泥? ?좎껌寃쎈줈)
 * Step 3: 鍮꾩슜 ?뺤씤 + ?쒖텧 (泥댄뿕鍮??뺤씤, honeypot)
 */

import { useState, useTransition } from "react";
import {
    findExistingTrialApplicationForEdit,
    submitTrialApplication,
    type AvailableSlot,
} from "@/app/actions/public";
import Link from "next/link";
import { trackMetaEvent } from "@/components/MetaPixel";
import FontFreeIcon from "@/components/ui/FontFreeIcon";

// ?? Props ??????????????????????????????????????????????????????????????????
interface Props {
    availableSlots: AvailableSlot[];
    contactPhone: string;
}

// ?? ?숇뀈 ?듭뀡 ????????????????????????????????????????????????????????????????
const GRADE_OPTIONS = [
    "6세", "7세", "초1", "초2", "초3", "초4", "초5", "초6",
    "중1", "중2", "중3", "고1", "고2", "고3", "성인",
];

// ?? ?좎껌 寃쎈줈 ?듭뀡 ??Google Form怨??숈씪 ?????????????????????????????????????
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
const TRIAL_DAY_ORDER = ["월", "화", "수", "목", "금", "토", "일"];
const TRIAL_FEE_PAYMENT_INFO = {
    amountLabel: "10,000원",
    bankName: "카카오뱅크",
    accountNumber: "3333-05-1344817",
    accountHolder: "김수빈",
    memo: "STIZ 체험수업비",
};
const TRIAL_FEE_COPY_TEXT = [
    "STIZ 농구교실 다산점 체험수업비 입금 안내",
    `금액: ${TRIAL_FEE_PAYMENT_INFO.amountLabel}`,
    `은행: ${TRIAL_FEE_PAYMENT_INFO.bankName}`,
    `계좌: ${TRIAL_FEE_PAYMENT_INFO.accountNumber}`,
    `예금주: ${TRIAL_FEE_PAYMENT_INFO.accountHolder}`,
    `메모: ${TRIAL_FEE_PAYMENT_INFO.memo}`,
].join("\n");

// ?? ???곗씠????????????????????????????????????????????????????????????????
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

function getSlotPeriod(slotKey: string) {
    return slotKey.split("-").at(-1) || "";
}

function orderedUniqueDays(slots: AvailableSlot[]) {
    const days = new Set(slots.map((slot) => slot.dayLabel).filter(Boolean));
    return TRIAL_DAY_ORDER.filter((day) => days.has(day));
}

export default function TrialApplicationForm({ availableSlots, contactPhone }: Props) {
    const [step, setStep] = useState(1);          // ?꾩옱 ?ㅽ뀦 (1~3)
    const [form, setForm] = useState<FormData>(INITIAL_FORM);
    const [error, setError] = useState("");
    const [completed, setCompleted] = useState(false);  // ?쒖텧 ?꾨즺 ?щ?
    const [existingLeadId, setExistingLeadId] = useState<string | null>(null);
    const [existingNotice, setExistingNotice] = useState("");
    const [completionMode, setCompletionMode] = useState<"created" | "updated">("created");
    const [paymentNotice, setPaymentNotice] = useState("");
    const [isPending, startTransition] = useTransition();
    const availableDayOptions = orderedUniqueDays(availableSlots);
    const dayOptions = availableDayOptions.length > 0 ? availableDayOptions : TRIAL_DAY_OPTIONS;
    const periodOptions = form.trialDay && availableSlots.length > 0
        ? availableSlots
            .filter((slot) => slot.dayLabel === form.trialDay)
            .map((slot) => ({ period: getSlotPeriod(slot.slotKey), slot }))
            .filter((option) => option.period)
        : TRIAL_PERIOD_OPTIONS.map((period) => ({ period, slot: null }));
    const selectedSlot = availableSlots.find((slot) => (
        slot.dayLabel === form.trialDay && getSlotPeriod(slot.slotKey) === form.trialPeriod
    ));

    const copyTextToClipboard = async (text: string) => {
        if (!navigator.clipboard?.writeText) {
            setPaymentNotice("?꾩옱 釉뚮씪?곗??먯꽌???먮룞 蹂듭궗媛 ?대졄?듬땲?? 怨꾩쥖踰덊샇瑜?湲멸쾶 ?뚮윭 蹂듭궗?댁＜?몄슂.");
            return false;
        }

        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            setPaymentNotice("蹂듭궗 沅뚰븳??李⑤떒?섏뿀?듬땲?? 怨꾩쥖踰덊샇瑜?吏곸젒 ?좏깮?댁꽌 蹂듭궗?댁＜?몄슂.");
            return false;
        }
    };

    const copyTrialFeeAccount = async () => {
        const copied = await copyTextToClipboard(TRIAL_FEE_PAYMENT_INFO.accountNumber);
        if (copied) setPaymentNotice("怨꾩쥖踰덊샇媛 蹂듭궗?섏뿀?듬땲??");
    };

    const handleTrialFeeTransfer = async () => {
        const copied = await copyTextToClipboard(TRIAL_FEE_COPY_TEXT);
        const sharePayload = {
            title: "STIZ 泥댄뿕?섏뾽鍮??낃툑 ?덈궡",
            text: TRIAL_FEE_COPY_TEXT,
        };

        if (navigator.share) {
            try {
                await navigator.share(sharePayload);
                setPaymentNotice("?↔툑 ?뺣낫媛 怨듭쑀?섏뿀?듬땲?? ?좎뒪??移댁뭅?ㅻ콉?ъ뿉???뺤씤??二쇱꽭??");
                return;
            } catch (e) {
                if (e instanceof DOMException && e.name === "AbortError") {
                    setPaymentNotice(copied ? "?↔툑 ?뺣낫媛 蹂듭궗?섏뿀?듬땲??" : "?↔툑 ?깆뿉??怨꾩쥖 ?뺣낫瑜?吏곸젒 ?낅젰?댁＜?몄슂.");
                    return;
                }
            }
        }

        setPaymentNotice(
            copied
                ? "?↔툑 ?뺣낫媛 蹂듭궗?섏뿀?듬땲?? ?좎뒪??移댁뭅?ㅻ콉?ъ뿉??遺숈뿬?ｌ뼱 二쇱꽭??"
                : "?↔툑 ?깆뿉??怨꾩쥖 ?뺣낫瑜?吏곸젒 ?낅젰?댁＜?몄슂."
        );
    };

    const update = (field: keyof FormData, value: string | boolean) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setError("");
    };

    const selectTrialDay = (day: string) => {
        setForm((prev) => ({
            ...prev,
            trialDay: day,
            trialPeriod: prev.trialDay === day ? prev.trialPeriod : "",
        }));
        setError("");
    };

    // ?? Step 1 ?좏슚??寃?????????????????????????????????????????????????????
    const validateStep1 = (): boolean => {
        if (!form.trialDate) { setError("泥댄뿕?섏뾽 ?щ쭩?쇱쓣 ?좏깮?댁＜?몄슂."); return false; }
        if (!form.trialDay) { setError("?붿씪???좏깮?댁＜?몄슂."); return false; }
        if (!form.trialPeriod) { setError("援먯떆瑜??좏깮?댁＜?몄슂."); return false; }
        return true;
    };

    // ?? Step 2 ?좏슚??寃?????????????????????????????????????????????????????
    const validateStep2 = (): boolean => {
        if (!form.childName.trim()) { setError("?꾩씠 ?대쫫???낅젰?댁＜?몄슂."); return false; }
        if (!form.childGender) { setError("?깅퀎???좏깮?댁＜?몄슂."); return false; }
        if (!form.childSchool.trim()) { setError("?숆탳瑜??낅젰?댁＜?몄슂."); return false; }
        if (!form.childGrade) { setError("?숇뀈???좏깮?댁＜?몄슂."); return false; }
        if (!form.parentPhone.trim()) { setError("?숇?紐??곕씫泥섎? ?낅젰?댁＜?몄슂."); return false; }
        // ?꾪솕踰덊샇 ?뺤떇 泥댄겕 (10~11?먮━ ?レ옄)
        const digits = form.parentPhone.replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 11) {
            setError("?щ컮瑜??꾪솕踰덊샇瑜??낅젰?댁＜?몄슂. (?? 010-1234-5678)");
            return false;
        }
        if (!form.source) { setError("?좎껌寃쎈줈瑜??좏깮?댁＜?몄슂."); return false; }
        return true;
    };

    // ?? ?ㅼ쓬 ?④퀎 ????????????????????????????????????????????????????????????
    const loadExistingApplication = async () => {
        const existing = await findExistingTrialApplicationForEdit({
            childName: form.childName,
            parentPhone: form.parentPhone,
        });
        if (!existing || existing.id === existingLeadId) return;

        setExistingLeadId(existing.id);
        setForm((prev) => ({
            ...prev,
            trialDate: existing.trialDate || prev.trialDate,
            trialDay: existing.trialDay || prev.trialDay,
            trialPeriod: existing.trialPeriod || prev.trialPeriod,
            childName: existing.childName || prev.childName,
            childGrade: existing.childGrade || prev.childGrade,
            childGender: existing.childGender || prev.childGender,
            childSchool: existing.childSchool || prev.childSchool,
            parentPhone: existing.parentPhone || prev.parentPhone,
            source: existing.source || prev.source,
            trialFeeConfirmed: existing.trialFeeConfirmed || prev.trialFeeConfirmed,
        }));
        setExistingNotice("기존 체험 신청서를 불러왔습니다. 필요한 부분만 수정해서 다시 제출해주세요.");
    };

    const goNext = async () => {
        if (step === 1 && !validateStep1()) return;
        if (step === 2 && !validateStep2()) return;
        if (step === 2) await loadExistingApplication();
        setError("");
        setStep((s) => Math.min(s + 1, 3));
        // ?ㅽ겕濡?理쒖긽?⑥쑝濡?(紐⑤컮??UX)
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // ?? ?댁쟾 ?④퀎 ????????????????????????????????????????????????????????????
    const goBack = () => {
        setError("");
        setStep((s) => Math.max(s - 1, 1));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // ?? ?쒖텧 ?????????????????????????????????????????????????????????????????
    const handleSubmit = () => {
        if (!form.trialFeeConfirmed) {
            setError("泥댄뿕?섏뾽 鍮꾩슜 ?뺤씤??泥댄겕?댁＜?몄슂.");
            return;
        }
        startTransition(async () => {
            try {
                const result = await submitTrialApplication({
                    ...form,
                    existingId: existingLeadId || undefined,
                    preferredSlotKey: selectedSlot?.slotKey,
                });
                setCompletionMode(result.mode === "updated" ? "updated" : "created");
                trackMetaEvent("Lead", {
                    content_name: "Trial application",
                    content_category: "Application",
                });
                setCompleted(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "?좎껌 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.");
            }
        });
    };

    // ?? ?꾨즺 ?붾㈃ ????????????????????????????????????????????????????????????
    if (completed) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
                {/* ?깃났 ?꾩씠肄?*/}
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
                    <FontFreeIcon name="check_circle" size={40} className="text-green-600" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3">
                    {completionMode === "updated" ? "체험수업 신청서 수정 완료!" : "체험수업 신청 완료!"}
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-2">?대떦?먭? 鍮좊Ⅸ ?쒓컙 ?댁뿉 ?곕씫?쒕━寃좎뒿?덈떎.</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                    臾몄쓽?ы빆???덉쑝?쒕㈃{" "}
                    <a href={`tel:${contactPhone.replace(/-/g, "")}`} className="text-brand-orange-500 dark:text-brand-neon-lime font-semibold">
                        {contactPhone}
                    </a>
                    ?쇰줈 ?꾪솕?댁＜?몄슂.
                </p>
                <div className="mb-6 rounded-2xl border border-brand-orange-200 bg-brand-orange-50/80 p-5 text-left dark:border-brand-neon-lime/40 dark:bg-brand-neon-lime/10">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-orange-500 text-white dark:bg-brand-neon-lime dark:text-brand-navy-950">
                            <FontFreeIcon name="payments" size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-brand-orange-600 dark:text-brand-neon-lime">Trial Fee</p>
                            <h3 className="mt-1 text-xl font-black text-gray-950 dark:text-white">泥댄뿕?섏뾽鍮??낃툑 ?덈궡</h3>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">?낃툑 ?뺤씤 ??泥댄뿕?섏뾽 ?쇱젙 ?덈궡媛 吏꾪뻾?⑸땲??</p>
                        </div>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl bg-white p-3 ring-1 ring-brand-orange-100 dark:bg-brand-navy-950/70 dark:ring-brand-neon-lime/20">
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400">체험비</p>
                            <p className="mt-1 text-lg font-black text-brand-orange-600 dark:text-brand-neon-lime">{TRIAL_FEE_PAYMENT_INFO.amountLabel}</p>
                        </div>
                        <div className="rounded-xl bg-white p-3 ring-1 ring-brand-orange-100 dark:bg-brand-navy-950/70 dark:ring-brand-neon-lime/20">
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400">은행</p>
                            <p className="mt-1 text-base font-black text-gray-950 dark:text-white">{TRIAL_FEE_PAYMENT_INFO.bankName}</p>
                        </div>
                        <div className="rounded-xl bg-white p-3 ring-1 ring-brand-orange-100 dark:bg-brand-navy-950/70 dark:ring-brand-neon-lime/20">
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400">예금주</p>
                            <p className="mt-1 text-base font-black text-gray-950 dark:text-white">{TRIAL_FEE_PAYMENT_INFO.accountHolder}</p>
                        </div>
                    </div>
                    <div className="mt-3 rounded-xl bg-white p-4 ring-1 ring-brand-orange-100 dark:bg-brand-navy-950/70 dark:ring-brand-neon-lime/20">
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400">?낃툑 怨꾩쥖</p>
                        <p className="mt-1 select-all break-all text-2xl font-black tracking-wide text-gray-950 dark:text-white">
                            {TRIAL_FEE_PAYMENT_INFO.accountNumber}
                        </p>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={copyTrialFeeAccount}
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brand-orange-200 bg-white px-4 py-3 text-sm font-black text-gray-950 transition-colors hover:border-brand-orange-500 dark:border-brand-neon-lime/30 dark:bg-brand-navy-950 dark:text-white dark:hover:border-brand-neon-lime"
                        >
                            <FontFreeIcon name="save" size={18} />
                            怨꾩쥖踰덊샇 蹂듭궗?섍린
                        </button>
                        <button
                            type="button"
                            onClick={handleTrialFeeTransfer}
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-orange-500 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-brand-orange-600 dark:bg-brand-neon-lime dark:text-brand-navy-950 dark:hover:bg-lime-400"
                        >
                            <FontFreeIcon name="send" size={18} />
                            ?↔툑?섍린
                        </button>
                    </div>
                    {paymentNotice && (
                        <p role="status" className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-sm font-bold text-gray-700 dark:bg-brand-navy-950/70 dark:text-gray-200">
                            {paymentNotice}
                        </p>
                    )}
                    <p className="mt-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                        ?↔툑?섍린瑜??꾨Ⅴ硫??↔툑 ?뺣낫媛 癒쇱? 蹂듭궗?⑸땲?? ?대??곗뿉??怨듭쑀 李쎌씠 ?⑤㈃ ?ъ슜?섎뒗 ?↔툑 ?깆쓣 ?좏깮?섍퀬, ?깆씠 諛붾줈 ?대━吏 ?딆쑝硫??좎뒪??移댁뭅?ㅻ콉?ъ뿉??遺숈뿬?ｌ뼱 二쇱꽭??
                    </p>
                </div>
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-brand-navy-900 text-white rounded-xl font-medium hover:bg-brand-navy-800 transition-colors dark:bg-brand-neon-lime dark:text-brand-navy-950 dark:hover:bg-lime-400"
                >
                    <FontFreeIcon name="home" size={18} />
                    ?덉쑝濡??뚯븘媛湲?                </Link>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
            {/* 吏꾪뻾 ?쒖떆以???3?④퀎 */}
            <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between max-w-sm mx-auto">
                    {[1, 2, 3].map((n) => (
                        <div key={n} className="flex items-center">
                            {/* ?ㅽ뀦 踰덊샇 ?먰삎 */}
                            <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                                    n < step
                                        ? "bg-green-500 text-white"         // ?꾨즺???ㅽ뀦
                                        : n === step
                                        ? "bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white"  // ?꾩옱 ?ㅽ뀦
                                        : "bg-gray-200 text-gray-400"       // 誘몃옒 ?ㅽ뀦
                                }`}
                            >
                                {n < step ? (
                                    <FontFreeIcon name="check" size={18} />
                                ) : (
                                    n
                                )}
                            </div>
                            {/* ?ㅽ뀦 ?대쫫 */}
                            <span className={`ml-2 text-xs font-medium hidden sm:inline ${
                                n === step ? "text-gray-900 dark:text-white" : "text-gray-400"
                            }`}>
                                {n === 1 ? "泥댄뿕 ?쇱젙" : n === 2 ? "?좎껌 ?뺣낫" : "鍮꾩슜 ?뺤씤"}
                            </span>
                            {/* ?곌껐??*/}
                            {n < 3 && (
                                <div className={`w-8 sm:w-12 h-0.5 mx-2 ${
                                    n < step ? "bg-green-500" : "bg-gray-200"
                                }`} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

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

                {/* ???????????? Step 1: 泥댄뿕 ?쇱젙 ???????????? */}
                {step === 1 && (
                    <div className="space-y-5">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <FontFreeIcon name="calendar_today" size={20} className="text-brand-orange-500 dark:text-brand-neon-lime" />
                            泥댄뿕 ?쇱젙
                        </h2>

                        {/* 泥댄뿕?섏뾽 ?щ쭩??*/}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                泥댄뿕?섏뾽 ?щ쭩??<span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={form.trialDate}
                                onChange={(e) => update("trialDate", e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* ?붿씪 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                                ?붿씪 <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                {dayOptions.map((day) => (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => selectTrialDay(day)}
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

                        {/* 援먯떆 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                                援먯떆 <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {periodOptions.map(({ period, slot }) => (
                                    <button
                                        key={slot?.slotKey || period}
                                        type="button"
                                        onClick={() => update("trialPeriod", period)}
                                        className={`py-3 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
                                            form.trialPeriod === period
                                                ? "border-brand-orange-500 dark:border-brand-neon-lime bg-brand-orange-50 dark:bg-brand-neon-lime/10 text-brand-orange-600 dark:text-brand-neon-lime"
                                                : "border-gray-300 text-gray-600 dark:text-gray-300 hover:border-gray-400"
                                        }`}
                                    >
                                        {period}援먯떆
                                        {slot && (
                                            <span className="block text-[11px] font-normal opacity-80">
                                                {slot.startTime}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ???????????? Step 2: 蹂댄샇??+ ?щ쭩 ?섏뾽 ???????????? */}
                {step === 2 && (
                    <div className="space-y-5">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <FontFreeIcon name="child_care" size={20} className="text-brand-orange-500 dark:text-brand-neon-lime" />
                            ?꾩씠 ?뺣낫 / ?곕씫泥?                        </h2>

                        {/* ?꾩씠 ?대쫫 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                ?대쫫 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.childName}
                                onChange={(e) => update("childName", e.target.value)}
                                placeholder="홍길동"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* ?깅퀎 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                ?깅퀎 <span className="text-red-500">*</span>
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

                        {/* ?숆탳 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                ?숆탳 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.childSchool}
                                onChange={(e) => update("childSchool", e.target.value)}
                                placeholder="?ㅼ궛珥덈벑?숆탳"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* ?숇뀈 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                ?숇뀈 <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={form.childGrade}
                                onChange={(e) => update("childGrade", e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                            >
                                <option value="">?좏깮?댁＜?몄슂</option>
                                {GRADE_OPTIONS.map((grade) => (
                                    <option key={grade} value={grade}>{grade}</option>
                                ))}
                            </select>
                        </div>

                        {/* ?숇?紐??곕씫泥?*/}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                ?숇?紐??곕씫泥?<span className="text-red-500">*</span>
                            </label>
                            <input
                                type="tel"
                                value={form.parentPhone}
                                onChange={(e) => {
                                    const nums = e.target.value.replace(/\D/g, "").slice(0, 11);
                                    let formatted = nums;
                                    if (nums.length > 7) formatted = `${nums.slice(0,3)}-${nums.slice(3,7)}-${nums.slice(7)}`;
                                    else if (nums.length > 3) formatted = `${nums.slice(0,3)}-${nums.slice(3)}`;
                                    update("parentPhone", formatted);
                                }}
                                placeholder="'-'?놁씠 ?レ옄留??낅젰?댁＜?몄슂"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white"
                            />
                            <p className="text-xs text-gray-400 mt-1">?レ옄留??낅젰?섎㈃ ?먮룞?쇰줈 000-0000-0000 ?뺤떇?쇰줈 蹂?섎맗?덈떎</p>
                        </div>

                        {/* ?좎껌 寃쎈줈 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                ?좎껌寃쎈줈 <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={form.source}
                                onChange={(e) => update("source", e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                            >
                                <option value="">?좏깮?댁＜?몄슂</option>
                                {SOURCE_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                {/* ???????????? Step 3: ?숈쓽 + ?쒖텧 ???????????? */}
                {step === 3 && (
                    <div className="space-y-5">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <FontFreeIcon name="verified" size={20} className="text-brand-orange-500 dark:text-brand-neon-lime" />
                            鍮꾩슜 ?뺤씤 諛??쒖텧
                        </h2>

                        {/* ?낅젰 ?뺣낫 ?붿빟 ???쒖텧 ???뺤씤??*/}
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-2 text-sm">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">?낅젰 ?뺣낫 ?뺤씤</h3>
                            <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
                                <span className="text-gray-500 dark:text-gray-400">희망일</span>
                                <span className="text-gray-900 dark:text-white">{form.trialDate}</span>
                                <span className="text-gray-500 dark:text-gray-400">?붿씪/援먯떆</span>
                                <span className="text-gray-900 dark:text-white">{form.trialDay}?붿씪 {form.trialPeriod}援먯떆</span>
                                <span className="text-gray-500 dark:text-gray-400">?꾩씠 ?대쫫</span>
                                <span className="text-gray-900 dark:text-white font-medium">{form.childName}</span>
                                <span className="text-gray-500 dark:text-gray-400">?깅퀎</span>
                                <span className="text-gray-900 dark:text-white">{form.childGender}</span>
                                <span className="text-gray-500 dark:text-gray-400">?숆탳</span>
                                <span className="text-gray-900 dark:text-white">{form.childSchool}</span>
                                <span className="text-gray-500 dark:text-gray-400">?숇뀈</span>
                                <span className="text-gray-900 dark:text-white">{form.childGrade}</span>
                                <span className="text-gray-500 dark:text-gray-400">연락처</span>
                                <span className="text-gray-900 dark:text-white">{form.parentPhone}</span>
                                <span className="text-gray-500 dark:text-gray-400">?좎껌寃쎈줈</span>
                                <span className="text-gray-900 dark:text-white">
                                    {SOURCE_OPTIONS.find((option) => option.value === form.source)?.label || form.source}
                                </span>
                            </div>
                        </div>

                        <TermsAccordion
                            title="泥댄뿕?섏뾽 鍮꾩슜 ?뺤씤"
                            required
                            checked={form.trialFeeConfirmed}
                            onCheck={(v) => update("trialFeeConfirmed", v)}
                        >
                            <TrialFeeContent />
                        </TermsAccordion>

                        {/* honeypot ?꾨뱶 ???ㅽ뙵遊?李⑤떒?? ?ъ슜?먯뿉寃?蹂댁씠吏 ?딆쓬 */}
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

                {/* ?? ?ㅻ퉬寃뚯씠??踰꾪듉 ??????????????????????????????????????????? */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
                    {/* ?댁쟾 踰꾪듉 */}
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
                        <div /> /* 鍮?怨듦컙 ???ㅼ쓬 踰꾪듉???ㅻⅨ履??뺣젹 ?좎? */
                    )}

                    {/* ?ㅼ쓬 / ?쒖텧 踰꾪듉 */}
                    {step < 3 ? (
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
                                    <FontFreeIcon name="sports_basketball" size={18} />
                                    泥댄뿕?섏뾽 ?좎껌?섍린
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ?? ?쎄? ?꾩퐫?붿뼵 而댄룷?뚰듃 ????????????????????????????????????????????????????
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
            {/* ?ㅻ뜑 ??泥댄겕諛뺤뒪 + ?쒕ぉ + ?쇱튂湲??묎린 */}
            <div className="flex items-center px-4 py-3 bg-gray-50 dark:bg-gray-900">
                {/* ?숈쓽 泥댄겕諛뺤뒪 */}
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
                {/* ?묎린/?쇱튂湲?踰꾪듉 */}
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="text-gray-400 hover:text-gray-600 dark:text-gray-300 p-1 cursor-pointer"
                >
                    <FontFreeIcon name="expand_more" size={18} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
            </div>
            {/* ?쎄? 蹂몃Ц ???쇱퀜???덉쓣 ?뚮쭔 ?쒖떆 */}
            {isOpen && (
                <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 max-h-48 overflow-y-auto text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    {children}
                </div>
            )}
        </div>
    );
}

// ?? ?댁슜?쎄? ?댁슜 ?????????????????????????????????????????????????????????????
function TrialFeeContent() {
    return (
        <div className="space-y-2">
            <p className="font-semibold text-gray-800 dark:text-gray-100">泥댄뿕?섏뾽 鍮꾩슜 ?덈궡</p>
            <p>泥댄뿕?섏뾽 鍮꾩슜? {TRIAL_FEE_PAYMENT_INFO.amountLabel}?낅땲??</p>
            <p>?낃툑怨꾩쥖: {TRIAL_FEE_PAYMENT_INFO.bankName} {TRIAL_FEE_PAYMENT_INFO.accountNumber} {TRIAL_FEE_PAYMENT_INFO.accountHolder}</p>
            <p>?좎껌 ???덈궡臾몄옄瑜?諛쏆쑝?붿빞 泥댄뿕?섏뾽???뺤젙?⑸땲??</p>
        </div>
    );
}
