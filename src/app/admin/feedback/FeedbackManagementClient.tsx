"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFeedback, updateFeedback, deleteFeedback } from "@/app/actions/admin";

// 카테고리 정의: 피드백을 4가지 유형으로 분류
const CATEGORIES: Record<string, { label: string; color: string }> = {
    SKILL: { label: "기술", color: "bg-blue-100 text-blue-700" },
    ATTITUDE: { label: "태도", color: "bg-green-100 text-green-700" },
    PHYSICAL: { label: "체력", color: "bg-orange-100 text-orange-700" },
    GENERAL: { label: "종합", color: "bg-purple-100 text-purple-700" },
};

// 피드백 데이터 타입 (getAllFeedbacks 반환값 기준)
type Feedback = {
    id: string;
    studentId: string;
    coachId: string;
    sessionDate: string | null;
    category: string;
    title: string;
    content: string;
    rating: number | null;
    isPublic: boolean;
    createdAt: string;
    coachName: string;
    studentName: string;
};

type Student = {
    id: string;
    name: string;
};

type Coach = {
    id: string;
    name: string;
};

type Props = {
    feedbacks: Feedback[];
    students: Student[];
    coaches: Coach[];
};

export default function FeedbackManagementClient({ feedbacks, students, coaches }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // 작성 폼 표시 여부
    const [showForm, setShowForm] = useState(false);
    // 수정 모드일 때 해당 피드백 ID
    const [editingId, setEditingId] = useState<string | null>(null);
    // 카드 펼침 상태 (어떤 카드가 열려있는지)
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // 폼 입력값 상태
    const [form, setForm] = useState({
        studentId: "",
        coachId: "",
        sessionDate: "",
        category: "GENERAL",
        title: "",
        content: "",
        rating: 0,
        isPublic: true,
    });

    // 폼 초기화
    function resetForm() {
        setForm({
            studentId: "",
            coachId: "",
            sessionDate: "",
            category: "GENERAL",
            title: "",
            content: "",
            rating: 0,
            isPublic: true,
        });
        setEditingId(null);
    }

    // 피드백 저장 (생성 또는 수정)
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.studentId || !form.coachId || !form.title || !form.content) {
            alert("학생, 코치, 제목, 내용은 필수 항목입니다.");
            return;
        }

        startTransition(async () => {
            try {
                if (editingId) {
                    // 수정 모드: 카테고리/제목/내용/평점/공개여부만 수정 가능
                    await updateFeedback(editingId, {
                        category: form.category,
                        title: form.title,
                        content: form.content,
                        rating: form.rating > 0 ? form.rating : null,
                        isPublic: form.isPublic,
                    });
                } else {
                    // 생성 모드: 모든 필드 전달
                    await createFeedback({
                        studentId: form.studentId,
                        coachId: form.coachId,
                        sessionDate: form.sessionDate || null,
                        category: form.category,
                        title: form.title,
                        content: form.content,
                        rating: form.rating > 0 ? form.rating : null,
                        isPublic: form.isPublic,
                    });
                }
                resetForm();
                setShowForm(false);
                router.refresh();
            } catch (err: any) {
                alert(err.message || "저장 실패");
            }
        });
    }

    // 수정 버튼 클릭 시: 폼에 기존 데이터 채우기
    function handleEdit(fb: Feedback) {
        setForm({
            studentId: fb.studentId,
            coachId: fb.coachId,
            sessionDate: fb.sessionDate ? fb.sessionDate.slice(0, 10) : "",
            category: fb.category,
            title: fb.title,
            content: fb.content,
            rating: fb.rating ?? 0,
            isPublic: fb.isPublic,
        });
        setEditingId(fb.id);
        setShowForm(true);
        // 페이지 상단으로 스크롤
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // 삭제 처리
    function handleDelete(id: string) {
        if (!confirm("이 피드백을 삭제하시겠습니까?")) return;
        startTransition(async () => {
            try {
                await deleteFeedback(id);
                router.refresh();
            } catch (err: any) {
                alert(err.message || "삭제 실패");
            }
        });
    }

    // 별점 렌더링 (1~5)
    function renderStars(rating: number | null) {
        if (!rating) return <span className="text-gray-400 text-sm">평점 없음</span>;
        return (
            <span className="text-yellow-400">
                {Array.from({ length: 5 }, (_, i) => (
                    <span key={i}>{i < rating ? "\u2605" : "\u2606"}</span>
                ))}
            </span>
        );
    }

    // 별점 입력 (폼 내부에서 클릭으로 점수 선택)
    function renderStarInput() {
        return (
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => setForm({ ...form, rating: form.rating === star ? 0 : star })}
                        className={`text-2xl transition-colors ${
                            star <= form.rating ? "text-yellow-400" : "text-gray-300"
                        } hover:text-yellow-400`}
                    >
                        {star <= form.rating ? "\u2605" : "\u2606"}
                    </button>
                ))}
                {form.rating > 0 && (
                    <span className="text-sm text-gray-500 ml-2 self-center">{form.rating}점</span>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 헤더: 제목 + 피드백 작성 버튼 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">학습 피드백 관리</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        원생별 학습 피드백을 작성하고 관리합니다. (총 {feedbacks.length}건)
                    </p>
                </div>
                <button
                    onClick={() => {
                        if (showForm && !editingId) {
                            // 폼이 열려있고 새 작성 중이면 닫기
                            setShowForm(false);
                            resetForm();
                        } else {
                            // 폼 열기 (수정 중이었으면 초기화)
                            resetForm();
                            setShowForm(true);
                        }
                    }}
                    className="px-5 py-2.5 bg-brand-orange-500 text-white rounded-xl font-medium hover:bg-brand-orange-600 transition-colors"
                >
                    {showForm && !editingId ? "닫기" : "피드백 작성"}
                </button>
            </div>

            {/* 피드백 작성/수정 폼 (토글) */}
            {showForm && (
                <form
                    onSubmit={handleSubmit}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4"
                >
                    <h2 className="text-lg font-bold text-gray-800">
                        {editingId ? "피드백 수정" : "새 피드백 작성"}
                    </h2>

                    {/* 학생 + 코치 선택 (2열) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 학생 드롭다운 - 수정 시에는 변경 불가 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                학생 <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={form.studentId}
                                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                                disabled={!!editingId}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 disabled:bg-gray-100"
                            >
                                <option value="">학생을 선택하세요</option>
                                {students.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* 코치 드롭다운 - 수정 시에는 변경 불가 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                코치 <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={form.coachId}
                                onChange={(e) => setForm({ ...form, coachId: e.target.value })}
                                disabled={!!editingId}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 disabled:bg-gray-100"
                            >
                                <option value="">코치를 선택하세요</option>
                                {coaches.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 날짜 + 카테고리 (2열) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">수업 날짜</label>
                            <input
                                type="date"
                                min="2020-01-01" max="2030-12-31"
                                value={form.sessionDate}
                                onChange={(e) => setForm({ ...form, sessionDate: e.target.value })}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                            <select
                                value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500"
                            >
                                {Object.entries(CATEGORIES).map(([key, { label }]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 제목 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            제목 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            placeholder="피드백 제목을 입력하세요"
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500"
                        />
                    </div>

                    {/* 내용 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            내용 <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={form.content}
                            onChange={(e) => setForm({ ...form, content: e.target.value })}
                            placeholder="학습 피드백 내용을 상세히 작성하세요"
                            rows={4}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-500 resize-none"
                        />
                    </div>

                    {/* 평점 + 공개여부 */}
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">평점</label>
                            {renderStarInput()}
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.isPublic}
                                onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
                                className="w-4 h-4 rounded border-gray-300 text-brand-orange-500 focus:ring-brand-orange-500"
                            />
                            <span className="text-sm text-gray-700">학부모에게 공개</span>
                        </label>
                    </div>

                    {/* 저장/취소 버튼 */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="px-6 py-2.5 bg-brand-orange-500 text-white rounded-xl font-medium hover:bg-brand-orange-600 transition-colors disabled:opacity-50"
                        >
                            {isPending ? "저장 중..." : editingId ? "수정 완료" : "피드백 저장"}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowForm(false);
                                resetForm();
                            }}
                            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                        >
                            취소
                        </button>
                    </div>
                </form>
            )}

            {/* 피드백 목록 (카드형) */}
            {feedbacks.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                    <p className="text-gray-400 text-lg">아직 작성된 피드백이 없습니다.</p>
                    <p className="text-gray-400 text-sm mt-1">상단의 "피드백 작성" 버튼을 눌러 첫 피드백을 작성해보세요.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {feedbacks.map((fb) => {
                        const isExpanded = expandedId === fb.id;
                        const cat = CATEGORIES[fb.category] || CATEGORIES.GENERAL;
                        // 날짜 포맷: "2026-03-20T..." → "2026.03.20"
                        const dateStr = fb.sessionDate
                            ? new Date(fb.sessionDate).toLocaleDateString("ko-KR")
                            : "";
                        const createdStr = new Date(fb.createdAt).toLocaleDateString("ko-KR");

                        return (
                            <div
                                key={fb.id}
                                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                            >
                                {/* 카드 헤더 (클릭하면 펼치기/접기) */}
                                <button
                                    type="button"
                                    onClick={() => setExpandedId(isExpanded ? null : fb.id)}
                                    className="w-full px-6 py-4 flex items-center gap-4 text-left hover:bg-gray-50 transition-colors"
                                >
                                    {/* 카테고리 뱃지 */}
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cat.color}`}>
                                        {cat.label}
                                    </span>

                                    {/* 학생 이름 */}
                                    <span className="font-bold text-gray-800 min-w-[60px]">
                                        {fb.studentName}
                                    </span>

                                    {/* 제목 */}
                                    <span className="text-gray-700 flex-1 truncate">{fb.title}</span>

                                    {/* 코치 이름 */}
                                    <span className="text-sm text-gray-500">{fb.coachName} 코치</span>

                                    {/* 날짜 */}
                                    <span className="text-sm text-gray-400 min-w-[80px] text-right">
                                        {dateStr || createdStr}
                                    </span>

                                    {/* 별점 */}
                                    <span className="min-w-[80px] text-right">{renderStars(fb.rating)}</span>

                                    {/* 공개/비공개 */}
                                    {!fb.isPublic && (
                                        <span className="text-xs text-red-400 border border-red-200 rounded-full px-2 py-0.5">
                                            비공개
                                        </span>
                                    )}

                                    {/* 펼침 아이콘 */}
                                    <span className={`text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                                        &#9660;
                                    </span>
                                </button>

                                {/* 펼쳐진 내용 */}
                                {isExpanded && (
                                    <div className="px-6 pb-5 border-t border-gray-100">
                                        {/* 피드백 내용 (줄바꿈 유지) */}
                                        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap mt-4">
                                            {fb.content}
                                        </p>

                                        {/* 수정/삭제 버튼 */}
                                        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                                            <button
                                                onClick={() => handleEdit(fb)}
                                                disabled={isPending}
                                                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                                            >
                                                수정
                                            </button>
                                            <button
                                                onClick={() => handleDelete(fb.id)}
                                                disabled={isPending}
                                                className="px-4 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
