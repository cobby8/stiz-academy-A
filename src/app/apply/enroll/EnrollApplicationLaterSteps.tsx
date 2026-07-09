"use client";

import { useState, type ReactNode } from "react";
import FontFreeIcon, { type FontFreeIconName } from "@/components/ui/FontFreeIcon";

interface AvailableSlot {
    slotKey: string;
    className: string;
    dayOfWeek: string;
    dayLabel: string;
    startTime: string;
    endTime: string;
    capacity: number;
    enrolled: number;
    available: number;
}

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
    preferredSlotKeys: string[];
    basketballExp: string;
    shuttleNeeded: boolean;
    shuttlePickup: string;
    shuttleDropoff: string;
    shuttleTime: string;
    referralSource: string;
    memo: string;
    agreedTerms: boolean;
    agreedPrivacy: boolean;
    honeypot: string;
}

interface EnrollApplicationLaterStepsProps {
    step: number;
    form: FormData;
    availableSlots: AvailableSlot[];
    update: (field: keyof FormData, value: string | boolean | string[]) => void;
    toggleSlot: (slotKey: string) => void;
}

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

const RELATION_OPTIONS = ["부", "모", "기타"];

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LABELS: Record<string, string> = {
    Mon: "월",
    Tue: "화",
    Wed: "수",
    Thu: "목",
    Fri: "금",
    Sat: "토",
    Sun: "일",
};

const BASKETBALL_EXP_OPTIONS = [
    { value: "없음", label: "없음" },
    { value: "1년 미만", label: "1년 미만" },
    { value: "1~3년", label: "1~3년" },
    { value: "3년 이상", label: "3년 이상" },
];

export default function EnrollApplicationLaterSteps({
    step,
    form,
    availableSlots,
    update,
    toggleSlot,
}: EnrollApplicationLaterStepsProps) {
    const slotsByDay = DAY_ORDER.reduce<Record<string, AvailableSlot[]>>((acc, day) => {
        const daySlots = availableSlots.filter((slot) => slot.dayOfWeek === day);
        if (daySlots.length > 0) acc[day] = daySlots;
        return acc;
    }, {});

    const selectedSlotsLabel = form.preferredSlotKeys
        .map((key) => {
            const slot = availableSlots.find((item) => item.slotKey === key);
            if (!slot) return key;
            return `${slot.dayLabel} ${slot.startTime}~${slot.endTime} (${slot.className})`;
        })
        .join(", ");

    return (
        <>
            {step === 2 && (
                <div className="space-y-5">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FontFreeIcon name="person" size={20} className="text-brand-orange-500 dark:text-brand-neon-lime" />
                        보호자 정보
                    </h2>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                            보호자 이름 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.parentName}
                            onChange={(event) => update("parentName", event.target.value)}
                            placeholder="홍부모"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                            보호자 연락처 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="tel"
                            value={form.parentPhone}
                            onChange={(event) => update("parentPhone", formatPhone(event.target.value))}
                            placeholder="숫자만 입력 (자동 변환: 010-1234-5678)"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white"
                        />
                        <p className="text-xs text-gray-400 mt-1">숫자만 입력하면 자동으로 000-0000-0000 형식으로 변환됩니다</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">관계</label>
                        <div className="flex gap-3">
                            {RELATION_OPTIONS.map((relation) => (
                                <button
                                    key={relation}
                                    type="button"
                                    onClick={() => update("parentRelation", relation)}
                                    className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
                                        form.parentRelation === relation
                                            ? "border-brand-orange-500 dark:border-brand-neon-lime bg-brand-orange-50 dark:bg-brand-neon-lime/10  text-brand-orange-600 dark:text-brand-neon-lime"
                                            : "border-gray-300 text-gray-600 dark:text-gray-300 hover:border-gray-400"
                                    }`}
                                >
                                    {relation}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                            주소 <span className="text-gray-400 text-xs font-normal">(선택)</span>
                        </label>
                        <input
                            type="text"
                            value={form.address}
                            onChange={(event) => update("address", event.target.value)}
                            placeholder="다산동 000아파트 000호"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white"
                        />
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="space-y-5">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FontFreeIcon name="sports_basketball" size={20} className="text-brand-orange-500 dark:text-brand-neon-lime" />
                        수강 정보
                    </h2>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                            희망 수업 <span className="text-gray-400 text-xs font-normal">(복수 선택 가능)</span>
                        </label>
                        {Object.keys(slotsByDay).length > 0 ? (
                            <div className="space-y-3">
                                {DAY_ORDER.filter((day) => slotsByDay[day]).map((day) => (
                                    <div key={day}>
                                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase">
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
                                                                ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-300 cursor-not-allowed"
                                                                : isSelected
                                                                ? "border-brand-orange-500 dark:border-brand-neon-lime bg-brand-orange-50 dark:bg-brand-neon-lime/10  text-brand-orange-600 dark:text-brand-neon-lime ring-2 ring-brand-orange-500 dark:focus:ring-brand-neon-lime/30"
                                                                : "border-gray-300 text-gray-700 dark:text-gray-200 hover:border-brand-navy-400 cursor-pointer"
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

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                            농구 경험 <span className="text-gray-400 text-xs font-normal">(선택)</span>
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {BASKETBALL_EXP_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => update("basketballExp", form.basketballExp === option.value ? "" : option.value)}
                                    className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
                                        form.basketballExp === option.value
                                            ? "border-brand-orange-500 dark:border-brand-neon-lime bg-brand-orange-50 dark:bg-brand-neon-lime/10  text-brand-orange-600 dark:text-brand-neon-lime"
                                            : "border-gray-300 text-gray-600 dark:text-gray-300 hover:border-gray-400"
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.shuttleNeeded}
                                onChange={(event) => update("shuttleNeeded", event.target.checked)}
                                className="w-5 h-5 rounded border-gray-300 text-brand-orange-500 dark:text-brand-neon-lime focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50"
                            />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">셔틀 이용을 희망합니다</span>
                        </label>
                    </div>

                    {form.shuttleNeeded && (
                        <div className="space-y-4 pl-2 border-l-2 border-brand-orange-200 ml-2">
                            <TextInput
                                label="셔틀 탑승 장소"
                                value={form.shuttlePickup}
                                onChange={(value) => update("shuttlePickup", value)}
                                placeholder="예: 다산 자이 아파트 정문 앞"
                            />
                            <TextInput
                                label="셔틀 하차 장소"
                                labelSuffix="(탑승지와 다른 경우)"
                                value={form.shuttleDropoff}
                                onChange={(value) => update("shuttleDropoff", value)}
                                placeholder="예: 한강 자이 아파트 후문"
                            />
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                    셔틀 희망 시간 <span className="text-gray-400 text-xs font-normal">(선택)</span>
                                </label>
                                <input
                                    type="time"
                                    value={form.shuttleTime}
                                    onChange={(event) => update("shuttleTime", event.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">어떻게 알게 되셨나요?</label>
                        <select
                            value={form.referralSource}
                            onChange={(event) => update("referralSource", event.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                        >
                            <option value="">선택해주세요</option>
                            {SOURCE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                            기타 요청사항 <span className="text-gray-400 text-xs font-normal">(선택)</span>
                        </label>
                        <textarea
                            value={form.memo}
                            onChange={(event) => update("memo", event.target.value)}
                            placeholder="궁금하신 점이나 요청사항을 자유롭게 적어주세요"
                            rows={3}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white resize-none"
                        />
                    </div>
                </div>
            )}

            {step === 4 && (
                <div className="space-y-5">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FontFreeIcon name="verified" size={20} className="text-brand-orange-500 dark:text-brand-neon-lime" />
                        입력 정보 확인 및 동의
                    </h2>

                    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-3 text-sm">
                        <SummarySection title="아이 정보" icon="child_care">
                            <SummaryRow label="이름" value={form.childName} strong />
                            <SummaryRow label="생년월일" value={form.childBirthDate} />
                            <SummaryRow label="성별" value={form.childGender} />
                            <SummaryRow label="학년" value={form.childGrade} />
                            <SummaryRow label="학교" value={form.childSchool} />
                            {form.childPhone && <SummaryRow label="학생 연락처" value={form.childPhone} />}
                        </SummarySection>

                        <hr className="border-gray-200 dark:border-gray-700" />

                        <SummarySection title="보호자 정보" icon="person">
                            <SummaryRow label="이름" value={form.parentName} strong />
                            <SummaryRow label="연락처" value={form.parentPhone} />
                            {form.parentRelation && <SummaryRow label="관계" value={form.parentRelation} />}
                            {form.address && <SummaryRow label="주소" value={form.address} />}
                        </SummarySection>

                        <hr className="border-gray-200 dark:border-gray-700" />

                        <SummarySection title="수강 정보" icon="sports_basketball">
                            {selectedSlotsLabel && <SummaryRow label="희망 수업" value={selectedSlotsLabel} />}
                            {form.basketballExp && <SummaryRow label="농구 경험" value={form.basketballExp} />}
                            {form.shuttleNeeded && <SummaryRow label="셔틀 탑승" value={form.shuttlePickup || "이용 희망"} />}
                            {form.shuttleDropoff && <SummaryRow label="셔틀 하차" value={form.shuttleDropoff} />}
                            {form.shuttleTime && <SummaryRow label="셔틀 시간" value={form.shuttleTime} />}
                            {form.memo && <SummaryRow label="요청사항" value={form.memo} />}
                        </SummarySection>
                    </div>

                    <TermsAccordion
                        title="이용약관 동의"
                        required
                        checked={form.agreedTerms}
                        onCheck={(value) => update("agreedTerms", value)}
                    >
                        <EnrollTermsContent />
                    </TermsAccordion>

                    <TermsAccordion
                        title="개인정보 수집/이용 동의"
                        required
                        checked={form.agreedPrivacy}
                        onCheck={(value) => update("agreedPrivacy", value)}
                    >
                        <EnrollPrivacyContent />
                    </TermsAccordion>

                    <div className="absolute left-[-9999px]" aria-hidden="true">
                        <input
                            type="text"
                            tabIndex={-1}
                            value={form.honeypot}
                            onChange={(event) => update("honeypot", event.target.value)}
                            autoComplete="off"
                        />
                    </div>
                </div>
            )}
        </>
    );
}

function formatPhone(value: string) {
    const nums = value.replace(/\D/g, "").slice(0, 11);
    if (nums.length > 7) return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`;
    if (nums.length > 3) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
    return nums;
}

function TextInput({
    label,
    labelSuffix,
    value,
    onChange,
    placeholder,
}: {
    label: string;
    labelSuffix?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
}) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                {label} {labelSuffix && <span className="text-gray-400 text-xs font-normal">{labelSuffix}</span>}
            </label>
            <input
                type="text"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50 focus:border-brand-orange-500 dark:border-brand-neon-lime outline-none transition-colors text-gray-900 dark:text-white"
            />
        </div>
    );
}

function SummarySection({ title, icon, children }: { title: string; icon: FontFreeIconName; children: ReactNode }) {
    return (
        <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1.5 flex items-center gap-1">
                <FontFreeIcon name={icon} size={14} className="text-gray-500 dark:text-gray-400" />
                {title}
            </h3>
            <div className="grid grid-cols-2 gap-y-1 gap-x-4 pl-5">{children}</div>
        </div>
    );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
    return (
        <>
            <span className="text-gray-500 dark:text-gray-400">{label}</span>
            <span className={`text-gray-900 dark:text-white ${strong ? "font-medium" : ""}`}>{value}</span>
        </>
    );
}

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
    onCheck: (value: boolean) => void;
    children: ReactNode;
}) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <div className="flex items-center px-4 py-3 bg-gray-50 dark:bg-gray-900">
                <label className="flex items-center gap-2 flex-1 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => onCheck(event.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-brand-orange-500 dark:text-brand-neon-lime focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime/50"
                    />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {title} {required && <span className="text-red-500">*</span>}
                    </span>
                </label>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="text-gray-400 hover:text-gray-600 dark:text-gray-300 p-1 cursor-pointer"
                >
                    <FontFreeIcon name="expand_more" size={18} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
            </div>
            {isOpen && (
                <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 max-h-48 overflow-y-auto text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    {children}
                </div>
            )}
        </div>
    );
}

function EnrollTermsContent() {
    return (
        <div className="space-y-2">
            <p className="font-semibold text-gray-800 dark:text-gray-100">STIZ 농구교실 수강 이용약관</p>
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

function EnrollPrivacyContent() {
    return (
        <div className="space-y-2">
            <p className="font-semibold text-gray-800 dark:text-gray-100">개인정보 수집/이용 동의</p>
            <p><strong>수집 항목:</strong> 아이 이름, 생년월일, 성별, 학년, 학교명, 학생 연락처, 보호자 이름, 보호자 연락처, 관계, 주소</p>
            <p><strong>수집 목적:</strong> 수강 신청 접수, 반 배정, 수강료 안내, 셔틀 운행, 수업 운영</p>
            <p><strong>보유 기간:</strong> 수강 종료 후 1년 (미등록 시 6개월)</p>
            <p><strong>동의 거부 권리:</strong> 동의를 거부할 수 있으나, 동의하지 않을 경우 수강 신청이 불가합니다.</p>
            <p>수집된 개인정보는 목적 외 용도로 사용되지 않으며, 제3자에게 제공되지 않습니다.</p>
        </div>
    );
}
