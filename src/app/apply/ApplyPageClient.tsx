"use client";

import { useState } from "react";

interface ApplyPageClientProps {
    trialTitle: string;
    trialContent: string | null;
    trialFormUrl: string | null;
    enrollTitle: string;
    enrollContent: string | null;
    enrollFormUrl: string | null;
}

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

export default function ApplyPageClient({
    trialTitle,
    trialContent,
    trialFormUrl,
    enrollTitle,
    enrollContent,
    enrollFormUrl,
}: ApplyPageClientProps) {
    const [modal, setModal] = useState<"trial" | "enroll" | null>(null);

    return (
        <>
            <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">
                {/* 체험수업 섹션 */}
                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="bg-brand-navy-900 px-6 py-5">
                        <p className="text-brand-orange-400 text-xs font-bold uppercase mb-1 tracking-widest">Trial Class</p>
                        <h2 className="text-2xl font-black text-white">{trialTitle}</h2>
                    </div>
                    <div className="px-6 py-6">
                        {trialContent ? (
                            <ContentBlock content={trialContent} />
                        ) : (
                            <p className="text-gray-400 text-sm italic">체험수업 안내 내용이 아직 등록되지 않았습니다.</p>
                        )}
                        <div className="mt-6">
                            {trialFormUrl ? (
                                <button
                                    onClick={() => setModal("trial")}
                                    className="inline-flex items-center gap-2 bg-brand-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-xl shadow transition"
                                >
                                    <span>🏀</span> 체험수업 신청하기
                                </button>
                            ) : (
                                <button
                                    disabled
                                    className="inline-flex items-center gap-2 bg-gray-200 text-gray-400 font-bold px-6 py-3 rounded-xl cursor-not-allowed"
                                >
                                    <span>🏀</span> 체험수업 신청하기 (준비 중)
                                </button>
                            )}
                        </div>
                    </div>
                </section>

                {/* 수강신청 섹션 */}
                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="bg-brand-orange-500 px-6 py-5">
                        <p className="text-white/70 text-xs font-bold uppercase mb-1 tracking-widest">Enrollment</p>
                        <h2 className="text-2xl font-black text-white">{enrollTitle}</h2>
                    </div>
                    <div className="px-6 py-6">
                        {enrollContent ? (
                            <ContentBlock content={enrollContent} />
                        ) : (
                            <p className="text-gray-400 text-sm italic">수강신청 안내 내용이 아직 등록되지 않았습니다.</p>
                        )}
                        <div className="mt-6">
                            {enrollFormUrl ? (
                                <button
                                    onClick={() => setModal("enroll")}
                                    className="inline-flex items-center gap-2 bg-brand-navy-900 hover:bg-gray-800 text-white font-bold px-6 py-3 rounded-xl shadow transition"
                                >
                                    <span>📋</span> 수강신청하기
                                </button>
                            ) : (
                                <button
                                    disabled
                                    className="inline-flex items-center gap-2 bg-gray-200 text-gray-400 font-bold px-6 py-3 rounded-xl cursor-not-allowed"
                                >
                                    <span>📋</span> 수강신청하기 (준비 중)
                                </button>
                            )}
                        </div>
                    </div>
                </section>
            </div>

            {/* Google Form 모달 */}
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
