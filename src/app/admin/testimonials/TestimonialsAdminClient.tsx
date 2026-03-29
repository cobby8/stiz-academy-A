"use client";

/**
 * TestimonialsAdminClient — 학부모 후기 관리 UI
 *
 * FaqAdminClient.tsx 패턴을 복제하여 구현.
 * - 상단: 네이버 플레이스 URL 설정
 * - 후기 CRUD: 모달 기반 생성/수정, 삭제 확인
 * - 순서 변경: 위/아래 버튼으로 order 값 스왑
 * - 아이콘: Material Symbols Outlined (lucide-react 사용 안 함)
 */

import { useState, useTransition } from "react";
import {
    createTestimonial,
    updateTestimonial,
    deleteTestimonial,
    updateAcademySettings,
} from "@/app/actions/admin";

// 후기 데이터 타입
type TestimonialData = {
    id: string;
    name: string;
    info: string;
    text: string;
    rating: number;
    order: number;
    isPublic: boolean;
    createdAt: Date | string;
};

// Material Symbols 아이콘 헬퍼 — 클래스명과 텍스트만 전달
function MIcon({ name, className = "" }: { name: string; className?: string }) {
    return (
        <span className={`material-symbols-outlined ${className}`} style={{ fontSize: "inherit" }}>
            {name}
        </span>
    );
}

export default function TestimonialsAdminClient({
    testimonials,
    naverPlaceUrl: initialNaverUrl,
}: {
    testimonials: TestimonialData[];
    naverPlaceUrl: string;
}) {
    const [isPending, startTransition] = useTransition();

    // ── 네이버 플레이스 URL 설정 ──
    const [naverUrl, setNaverUrl] = useState(initialNaverUrl);
    const [naverSaved, setNaverSaved] = useState(false);

    function handleSaveNaverUrl() {
        startTransition(async () => {
            await updateAcademySettings({ naverPlaceUrl: naverUrl });
            setNaverSaved(true);
            setTimeout(() => setNaverSaved(false), 2000);
        });
    }

    // ── 모달 상태 ──
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);

    // 폼 필드 상태
    const [name, setName] = useState("");
    const [info, setInfo] = useState("");
    const [text, setText] = useState("");
    const [rating, setRating] = useState(5);
    const [order, setOrder] = useState(0);
    const [isPublic, setIsPublic] = useState(true);

    // 폼 초기화
    function resetForm() {
        setEditId(null);
        setName("");
        setInfo("");
        setText("");
        setRating(5);
        setOrder(0);
        setIsPublic(true);
        setShowForm(false);
    }

    // 수정 모드 — 기존 데이터를 폼에 채움
    function startEdit(t: TestimonialData) {
        setEditId(t.id);
        setName(t.name);
        setInfo(t.info);
        setText(t.text);
        setRating(t.rating);
        setOrder(t.order);
        setIsPublic(t.isPublic);
        setShowForm(true);
    }

    // 저장 (생성 또는 수정)
    function handleSubmit() {
        if (!name.trim()) { alert("작성자명을 입력해주세요."); return; }
        if (!text.trim()) { alert("후기 내용을 입력해주세요."); return; }
        const payload = { name, info, text, rating, order, isPublic };
        startTransition(async () => {
            if (editId) {
                await updateTestimonial(editId, payload);
            } else {
                await createTestimonial(payload);
            }
            resetForm();
        });
    }

    // 삭제
    function handleDelete(id: string) {
        if (!confirm("이 후기를 삭제하시겠습니까?")) return;
        startTransition(async () => { await deleteTestimonial(id); });
    }

    // 순서 변경 — 인접 항목과 order 값 스왑
    function handleReorder(index: number, direction: "up" | "down") {
        const targetIdx = direction === "up" ? index - 1 : index + 1;
        if (targetIdx < 0 || targetIdx >= testimonials.length) return;

        const current = testimonials[index];
        const target = testimonials[targetIdx];

        startTransition(async () => {
            // 두 항목의 order 값을 교환
            await updateTestimonial(current.id, {
                name: current.name, info: current.info, text: current.text,
                rating: current.rating, order: target.order, isPublic: current.isPublic,
            });
            await updateTestimonial(target.id, {
                name: target.name, info: target.info, text: target.text,
                rating: target.rating, order: current.order, isPublic: target.isPublic,
            });
        });
    }

    // 별점 렌더링
    const renderStars = (r: number) =>
        Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={i < r ? "text-yellow-400" : "text-gray-300"}>&#9733;</span>
        ));

    return (
        <div className="space-y-6">
            {/* 페이지 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">학부모 후기 관리</h1>
                    <p className="text-sm text-gray-500 mt-1">메인 페이지에 표시되는 학부모 후기를 관리합니다</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center gap-2 bg-brand-orange-500 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-orange-600 transition"
                >
                    <span className="text-lg"><MIcon name="add" /></span> 새 후기
                </button>
            </div>

            {/* 네이버 플레이스 URL 설정 카드 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="text-lg text-green-600"><MIcon name="link" /></span>
                    네이버 플레이스 리뷰 링크
                </h2>
                <p className="text-xs text-gray-400 mb-3">
                    입력하면 메인 페이지 후기 섹션 하단에 &quot;네이버 플레이스에서 더 많은 후기 보기&quot; 버튼이 표시됩니다
                </p>
                <div className="flex gap-2">
                    <input
                        value={naverUrl}
                        onChange={e => setNaverUrl(e.target.value)}
                        placeholder="https://naver.me/... 또는 https://map.naver.com/..."
                        className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
                    />
                    <button
                        onClick={handleSaveNaverUrl}
                        disabled={isPending}
                        className="px-5 py-2.5 bg-brand-navy-900 text-white font-bold rounded-xl hover:bg-brand-navy-800 transition disabled:opacity-50 text-sm"
                    >
                        {naverSaved ? "저장됨" : "저장"}
                    </button>
                </div>
            </div>

            {/* 생성/수정 모달 */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={resetForm}>
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                        {/* 모달 헤더 */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-lg font-bold">{editId ? "후기 수정" : "새 후기"}</h2>
                            <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg text-xl">
                                <MIcon name="close" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* 작성자명 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">작성자명</label>
                                <input value={name} onChange={e => setName(e.target.value)}
                                    placeholder='예: 김O O'
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm" />
                            </div>
                            {/* 관계/정보 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">관계/정보</label>
                                <input value={info} onChange={e => setInfo(e.target.value)}
                                    placeholder='예: 초3 학부모'
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm" />
                            </div>
                            {/* 후기 내용 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">후기 내용</label>
                                <textarea value={text} onChange={e => setText(e.target.value)}
                                    rows={4} placeholder="후기 내용을 입력하세요"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm" />
                            </div>
                            {/* 별점, 순서, 공개여부 — 가로 배치 */}
                            <div className="flex gap-4 flex-wrap">
                                <div className="w-24">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">별점</label>
                                    <select value={rating} onChange={e => setRating(Number(e.target.value))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm">
                                        {[5, 4, 3, 2, 1].map(v => (
                                            <option key={v} value={v}>{v}점</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-28">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">표시 순서</label>
                                    <input type="number" value={order} onChange={e => setOrder(Number(e.target.value))}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm" />
                                    <p className="text-xs text-gray-400 mt-1">작을수록 먼저</p>
                                </div>
                                <div className="flex items-center gap-2 pt-6">
                                    <input type="checkbox" id="isPublicT" checked={isPublic}
                                        onChange={e => setIsPublic(e.target.checked)} className="rounded" />
                                    <label htmlFor="isPublicT" className="text-sm text-gray-700">공개</label>
                                </div>
                            </div>
                        </div>
                        {/* 모달 하단 버튼 */}
                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={resetForm}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition">
                                취소
                            </button>
                            <button onClick={handleSubmit} disabled={isPending}
                                className="px-6 py-2 bg-brand-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition disabled:opacity-50">
                                {isPending ? "저장 중..." : editId ? "수정" : "등록"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 후기 목록 */}
            {testimonials.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
                    <span className="material-symbols-outlined text-5xl text-gray-300 mb-3 block">rate_review</span>
                    <p className="font-medium">아직 등록된 후기가 없습니다</p>
                    <p className="text-sm mt-1">&quot;새 후기&quot; 버튼으로 학부모 후기를 추가하세요</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {testimonials.map((t, idx) => (
                        <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    {/* 작성자 + 별점 */}
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-gray-900">{t.name}</span>
                                        <span className="text-sm text-gray-400">{t.info}</span>
                                        <span className="text-sm">{renderStars(t.rating)}</span>
                                    </div>
                                    {/* 후기 내용 미리보기 */}
                                    <p className="text-sm text-gray-500 line-clamp-2 mb-2">&ldquo;{t.text}&rdquo;</p>
                                    {/* 메타 정보 */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs text-gray-400">순서: {t.order}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                            t.isPublic ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                                        }`}>
                                            <span className="text-xs"><MIcon name={t.isPublic ? "visibility" : "visibility_off"} /></span>
                                            {t.isPublic ? "공개" : "비공개"}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {new Date(t.createdAt).toLocaleDateString("ko-KR")}
                                        </span>
                                    </div>
                                </div>
                                {/* 순서/수정/삭제 버튼 */}
                                <div className="flex gap-1 flex-shrink-0 items-center">
                                    {/* 위로 이동 */}
                                    <button onClick={() => handleReorder(idx, "up")}
                                        disabled={idx === 0 || isPending}
                                        className="p-2 text-gray-400 hover:text-brand-navy-900 hover:bg-blue-50 rounded-lg transition disabled:opacity-30 text-lg"
                                        title="위로">
                                        <MIcon name="arrow_upward" />
                                    </button>
                                    {/* 아래로 이동 */}
                                    <button onClick={() => handleReorder(idx, "down")}
                                        disabled={idx === testimonials.length - 1 || isPending}
                                        className="p-2 text-gray-400 hover:text-brand-navy-900 hover:bg-blue-50 rounded-lg transition disabled:opacity-30 text-lg"
                                        title="아래로">
                                        <MIcon name="arrow_downward" />
                                    </button>
                                    {/* 수정 */}
                                    <button onClick={() => startEdit(t)}
                                        className="p-2 text-gray-400 hover:text-brand-orange-500 hover:bg-orange-50 rounded-lg transition text-lg">
                                        <MIcon name="edit" />
                                    </button>
                                    {/* 삭제 */}
                                    <button onClick={() => handleDelete(t.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition text-lg">
                                        <MIcon name="delete" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
