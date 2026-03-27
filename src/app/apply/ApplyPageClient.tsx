"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import AnimateOnScroll from "@/components/ui/AnimateOnScroll";
import SectionLayout from "@/components/ui/SectionLayout";

// FAQ 데이터 타입 (DB에서 가져온 FAQ 항목)
type FaqItem = { id: string; question: string; answer: string };

interface ApplyPageClientProps {
    trialTitle: string;
    trialContent: string | null;
    trialFormUrl: string | null;
    enrollTitle: string;
    enrollContent: string | null;
    enrollFormUrl: string | null;
    // DB에서 가져온 FAQ 데이터 (없으면 기본 FAQ 표시)
    faqData?: FaqItem[];
}

// --- FormModal: 기존 코드 그대로 유지 (절대 변경 금지) ---
function FormModal({
    title,
    formUrl,
    onClose,
}: {
    title: string;
    formUrl: string;
    onClose: () => void;
}) {
    // Google Forms embed URL: replace /viewform with /viewform?embedded=true
    const embedUrl = formUrl.includes("?")
        ? formUrl.replace(/[?&]embedded=true/, "") + "&embedded=true"
        : formUrl + "?embedded=true";

    return (
        <div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col"
                style={{ maxHeight: "90vh" }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                    <span className="font-bold text-gray-800 text-base">{title}</span>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                    >
                        ✕
                    </button>
                </div>
                <div className="flex-1 overflow-hidden">
                    <iframe
                        src={embedUrl}
                        width="100%"
                        height="600"
                        frameBorder="0"
                        marginHeight={0}
                        marginWidth={0}
                        className="block"
                        title={title}
                    >
                        로딩 중...
                    </iframe>
                </div>
            </div>
        </div>
    );
}

// --- ContentBlock: 기존 코드 그대로 유지 (절대 변경 금지) ---
function ContentBlock({ content }: { content: string }) {
    const isHtml = /<[a-z][\s\S]*>/i.test(content);
    if (isHtml) {
        return (
            <div
                className="prose prose-gray max-w-none text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: content }}
            />
        );
    }
    return (
        <p className="text-gray-700 leading-relaxed whitespace-pre-line">{content}</p>
    );
}

// --- 기본 FAQ 데이터 --- DB에 데이터가 없을 때 fallback으로 사용
const DEFAULT_FAQ_DATA = [
    {
        question: "체험수업은 무료인가요?",
        answer: "네, 첫 체험수업은 무료로 진행됩니다. 운동복과 실내화만 준비해 주시면 됩니다.",
    },
    {
        question: "몇 살부터 수업을 들을 수 있나요?",
        answer: "유아반(5~7세)부터 중등반(13~15세)까지 연령별 맞춤 수업을 운영하고 있습니다.",
    },
    {
        question: "수업은 주 몇 회인가요?",
        answer: "프로그램에 따라 주 1회~3회까지 선택할 수 있습니다. 자세한 시간표는 시간표 페이지를 참고해 주세요.",
    },
    {
        question: "중간에 반 변경이 가능한가요?",
        answer: "네, 코치와 상담 후 아이의 실력과 일정에 맞춰 반 변경이 가능합니다.",
    },
    {
        question: "수강료 환불은 어떻게 되나요?",
        answer: "학원 환불 규정에 따라 처리됩니다. 자세한 내용은 전화 상담을 통해 안내받으실 수 있습니다.",
    },
];

// --- FAQ 아코디언 아이템 ---
function FAQItem({ question, answer }: { question: string; answer: string }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="border-b border-gray-100 last:border-b-0">
            {/* 질문 버튼 — 클릭 시 답변 토글 */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between py-5 px-1 text-left hover:text-brand-orange-500 transition-colors cursor-pointer"
            >
                <span className="font-semibold text-gray-900 pr-4">{question}</span>
                {/* 화살표 아이콘 — 열림/닫힘 상태에 따라 회전 */}
                <svg
                    className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {/* 답변 영역 — isOpen일 때만 표시 */}
            {isOpen && (
                <div className="pb-5 px-1">
                    <p className="text-gray-600 text-base leading-relaxed">{answer}</p>
                </div>
            )}
        </div>
    );
}

export default function ApplyPageClient({
    trialTitle,
    trialContent,
    trialFormUrl,
    enrollTitle,
    enrollContent,
    enrollFormUrl,
    faqData,
}: ApplyPageClientProps) {
    const [modal, setModal] = useState<"trial" | "enroll" | null>(null);
    // DB FAQ가 있으면 사용, 없으면 기본 FAQ fallback
    const displayFaqs = faqData && faqData.length > 0 ? faqData : DEFAULT_FAQ_DATA;

    return (
        <>
            {/* 체험수업 / 수강신청 카드 섹션 */}
            <SectionLayout label="APPLY NOW" title="신청하기" description="체험수업 또는 수강신청을 선택하세요" bgColor="section">
                <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    {/* 체험수업 카드 — 앵커 id="trial"로 챗봇에서 바로 스크롤 가능 */}
                    <AnimateOnScroll>
                        <Card id="trial" variant="default" className="overflow-hidden !p-0 h-full">
                            {/* 카드 헤더 — 네이비 배경 */}
                            <div className="bg-brand-navy-900 px-6 py-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="default" size="sm">Trial Class</Badge>
                                </div>
                                <h3 className="text-xl font-black text-white">{trialTitle}</h3>
                            </div>
                            {/* 카드 본문 */}
                            <div className="px-6 py-6">
                                {/* 체험 혜택 강조 태그들 */}
                                <div className="flex flex-wrap gap-2 mb-4">
                                    <Badge variant="success" size="sm">무료 체험</Badge>
                                    <Badge variant="info" size="sm">준비물: 운동복, 실내화</Badge>
                                </div>

                                {trialContent ? (
                                    <ContentBlock content={trialContent} />
                                ) : (
                                    <p className="text-gray-400 text-base italic">체험수업 안내 내용이 아직 등록되지 않았습니다.</p>
                                )}

                                <div className="mt-6">
                                    {trialFormUrl ? (
                                        <Button
                                            variant="primary"
                                            size="md"
                                            onClick={() => setModal("trial")}
                                            data-tour-target="trial-apply-btn"
                                        >
                                            체험수업 신청하기
                                        </Button>
                                    ) : (
                                        <Button variant="primary" size="md" disabled className="!bg-gray-200 !text-gray-400 cursor-not-allowed">
                                            체험수업 신청하기 (준비 중)
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </AnimateOnScroll>

                    {/* 수강신청 카드 — 앵커 id="enroll"로 챗봇에서 바로 스크롤 가능 */}
                    <AnimateOnScroll delay={150}>
                        <Card id="enroll" variant="default" className="overflow-hidden !p-0 h-full">
                            {/* 카드 헤더 — 오렌지 배경으로 차별화 */}
                            <div className="bg-brand-orange-500 px-6 py-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="inline-flex items-center rounded-full font-medium px-2 py-0.5 text-xs bg-white/20 text-white">Enrollment</span>
                                </div>
                                <h3 className="text-xl font-black text-white">{enrollTitle}</h3>
                            </div>
                            {/* 카드 본문 */}
                            <div className="px-6 py-6">
                                {enrollContent ? (
                                    <ContentBlock content={enrollContent} />
                                ) : (
                                    <p className="text-gray-400 text-base italic">수강신청 안내 내용이 아직 등록되지 않았습니다.</p>
                                )}

                                <div className="mt-6">
                                    {enrollFormUrl ? (
                                        <Button
                                            variant="secondary"
                                            size="md"
                                            onClick={() => setModal("enroll")}
                                        >
                                            수강신청하기
                                        </Button>
                                    ) : (
                                        <Button variant="secondary" size="md" disabled className="!bg-gray-200 !text-gray-400 cursor-not-allowed">
                                            수강신청하기 (준비 중)
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </AnimateOnScroll>
                </div>
            </SectionLayout>

            {/* FAQ 섹션 — 아코디언 형태의 자주 묻는 질문 */}
            <SectionLayout label="FAQ" title="자주 묻는 질문" description="궁금한 점을 빠르게 확인하세요" bgColor="white">
                <AnimateOnScroll>
                    <Card variant="default" className="!p-0 max-w-3xl mx-auto">
                        <div className="px-6 py-2">
                            {displayFaqs.map((faq, i) => (
                                <FAQItem key={i} question={faq.question} answer={faq.answer} />
                            ))}
                        </div>
                    </Card>
                </AnimateOnScroll>
            </SectionLayout>

            {/* Google Form 모달 — 기존 로직 그대로 유지 */}
            {modal === "trial" && trialFormUrl && (
                <FormModal
                    title={trialTitle}
                    formUrl={trialFormUrl}
                    onClose={() => setModal(null)}
                />
            )}
            {modal === "enroll" && enrollFormUrl && (
                <FormModal
                    title={enrollTitle}
                    formUrl={enrollFormUrl}
                    onClose={() => setModal(null)}
                />
            )}
        </>
    );
}
