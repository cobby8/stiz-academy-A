"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    saveSessionReport,
    publishSessionReport,
    saveStudentSessionNotes,
} from "@/app/actions/admin";

// ── 타입 정의 ──────────────────────────────────────────────────────────────────

type AttendanceRecord = {
    id: string;
    studentId: string;
    status: string;
    studentName: string;
};

type NoteRecord = {
    id: string;
    studentId: string;
    note: string;
    rating: number | null;
    studentName: string;
};

type ReportData = {
    id: string;
    classId: string;
    date: string;
    topic: string | null;
    content: string | null;
    photosJSON: string | null;
    coachId: string | null;
    coachName: string | null;
    published: boolean;
    publishedAt: string | null;
    className: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    programName: string | null;
    attendances: AttendanceRecord[];
    notes: NoteRecord[];
};

type Coach = {
    id: string;
    name: string;
    role: string;
};

// 요일 한글 변환
const DAY_LABELS: Record<string, string> = {
    Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};

// 출석 상태 라벨/색상
const STATUS_MAP: Record<string, { label: string; color: string }> = {
    PRESENT: { label: "출석", color: "bg-green-100 text-green-700" },
    ABSENT: { label: "결석", color: "bg-red-100 text-red-700" },
    LATE: { label: "지각", color: "bg-yellow-100 text-yellow-700" },
};

export default function ReportEditClient({
    report,
    coaches,
}: {
    report: ReportData;
    coaches: Coach[];
}) {
    const router = useRouter();

    // ── 리포트 기본 정보 상태 ──
    const [topic, setTopic] = useState(report.topic || "");
    const [content, setContent] = useState(report.content || "");
    const [coachId, setCoachId] = useState(report.coachId || "");
    const [photosJSON, setPhotosJSON] = useState(report.photosJSON || "[]");
    const [published, setPublished] = useState(report.published);

    // ── 학생별 노트 상태 (출석 목록 기반으로 초기화) ──
    // 기존 노트를 studentId로 빠르게 찾기 위한 맵
    const noteMap = new Map(report.notes.map((n) => [n.studentId, n]));
    const [studentNotes, setStudentNotes] = useState<
        Record<string, { note: string; rating: number | null }>
    >(() => {
        const initial: Record<string, { note: string; rating: number | null }> = {};
        for (const a of report.attendances) {
            const existing = noteMap.get(a.studentId);
            initial[a.studentId] = {
                note: existing?.note || "",
                rating: existing?.rating ?? null,
            };
        }
        return initial;
    });

    // ── 저장 상태 ──
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [publishing, setPublishing] = useState(false);

    // 사진 URL 배열 파싱
    let photos: string[] = [];
    try { photos = JSON.parse(photosJSON); } catch { photos = []; }

    // 사진 URL 추가
    const addPhotoUrl = useCallback(() => {
        const url = prompt("사진 URL을 입력하세요:");
        if (!url?.trim()) return;
        const updated = [...photos, url.trim()];
        setPhotosJSON(JSON.stringify(updated));
    }, [photos]);

    // 사진 URL 삭제
    const removePhoto = useCallback((index: number) => {
        const updated = photos.filter((_, i) => i !== index);
        setPhotosJSON(JSON.stringify(updated));
    }, [photos]);

    // 학생 노트 변경
    const updateNote = (studentId: string, note: string) => {
        setStudentNotes((prev) => ({
            ...prev,
            [studentId]: { ...prev[studentId], note },
        }));
        setSaved(false);
    };

    // 학생 평점 변경
    const updateRating = (studentId: string, rating: number | null) => {
        setStudentNotes((prev) => ({
            ...prev,
            [studentId]: { ...prev[studentId], rating },
        }));
        setSaved(false);
    };

    // ── 리포트 저장 (기본 정보 + 학생별 노트) ──
    async function handleSave() {
        setSaving(true);
        setSaved(false);
        try {
            // 1. 세션 리포트 기본 정보 저장
            await saveSessionReport({
                sessionId: report.id,
                topic: topic || undefined,
                content: content || undefined,
                photosJSON: photosJSON !== "[]" ? photosJSON : undefined,
                coachId: coachId || undefined,
            });

            // 2. 학생별 노트 저장 (노트가 있는 것만)
            const notesToSave = Object.entries(studentNotes)
                .filter(([, v]) => v.note.trim())
                .map(([studentId, v]) => ({
                    studentId,
                    note: v.note,
                    rating: v.rating,
                }));
            if (notesToSave.length > 0) {
                await saveStudentSessionNotes(report.id, notesToSave);
            }

            setSaved(true);
            router.refresh();
        } catch (err: any) {
            alert(err.message || "저장 실패");
        } finally {
            setSaving(false);
        }
    }

    // ── 발행/발행취소 토글 ──
    async function handleTogglePublish() {
        const newState = !published;
        const msg = newState
            ? "리포트를 발행하시겠습니까? 학부모에게 알림이 전송됩니다."
            : "리포트 발행을 취소하시겠습니까? 학부모가 더 이상 볼 수 없습니다.";
        if (!confirm(msg)) return;

        setPublishing(true);
        try {
            await publishSessionReport(report.id, newState);
            setPublished(newState);
            router.refresh();
        } catch (err: any) {
            alert(err.message || "발행 상태 변경 실패");
        } finally {
            setPublishing(false);
        }
    }

    // 날짜 포맷
    const dateStr = new Date(report.date).toLocaleDateString("ko-KR", {
        year: "numeric", month: "long", day: "numeric", weekday: "short",
    });

    return (
        <div className="max-w-4xl mx-auto">
            {/* 헤더: 뒤로가기 + 제목 */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <Link
                        href="/admin/attendance/report"
                        className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-200 flex items-center gap-1 mb-2"
                    >
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                        리포트 목록
                    </Link>
                    <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">수업 리포트 편집</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                        {dateStr} | {report.className} ({DAY_LABELS[report.dayOfWeek] || report.dayOfWeek} {report.startTime}~{report.endTime})
                        {report.programName && <span className="ml-2 text-gray-400">- {report.programName}</span>}
                    </p>
                </div>
                {/* 발행 상태 배지 */}
                <div className="flex items-center gap-3">
                    {published ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-700">
                            <span className="material-symbols-outlined text-base">check_circle</span>
                            발행됨
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                            <span className="material-symbols-outlined text-base">edit_note</span>
                            미발행
                        </span>
                    )}
                </div>
            </div>

            {/* 기본 정보 카드 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 mb-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined">description</span>
                    수업 정보
                </h2>

                <div className="space-y-4">
                    {/* 수업 주제 */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">수업 주제</label>
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => { setTopic(e.target.value); setSaved(false); }}
                            placeholder="예: 드리블 연습, 3대3 미니게임"
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 text-sm dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime focus:border-brand-orange-500"
                        />
                    </div>

                    {/* 담당 코치 */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">담당 코치</label>
                        <select
                            value={coachId}
                            onChange={(e) => { setCoachId(e.target.value); setSaved(false); }}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime bg-white dark:bg-gray-800"
                        >
                            <option value="">코치 선택</option>
                            {coaches.map((c) => (
                                <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
                            ))}
                        </select>
                    </div>

                    {/* 수업 내용 */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">수업 내용</label>
                        <textarea
                            value={content}
                            onChange={(e) => { setContent(e.target.value); setSaved(false); }}
                            placeholder="오늘 수업에서 진행한 내용을 작성해주세요."
                            rows={4}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 text-sm dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime resize-y"
                        />
                    </div>

                    {/* 수업 사진 */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">수업 사진</label>
                        {photos.length > 0 && (
                            <div className="flex flex-wrap gap-3 mb-3">
                                {photos.map((url, i) => (
                                    <div key={i} className="relative group">
                                        <img
                                            src={url}
                                            alt={`수업 사진 ${i + 1}`}
                                            className="w-24 h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = "";
                                                (e.target as HTMLImageElement).alt = "이미지 로드 실패";
                                            }}
                                        />
                                        <button
                                            onClick={() => removePhoto(i)}
                                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                        >
                                            X
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button
                            onClick={addPhotoUrl}
                            className="text-sm text-brand-orange-500 dark:text-brand-neon-lime font-bold hover:underline flex items-center gap-1"
                        >
                            <span className="material-symbols-outlined text-sm">add_photo_alternate</span>
                            사진 URL 추가
                        </button>
                    </div>
                </div>
            </div>

            {/* 출석 현황 + 학생별 노트 카드 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-6">
                <div className="p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined">people</span>
                        출석 현황 및 학생별 코멘트
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                        각 학생에 대한 개별 코멘트를 작성할 수 있습니다. 학부모에게 리포트 발행 시 함께 전달됩니다.
                    </p>
                </div>

                {report.attendances.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                        출석 기록이 없습니다.
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {report.attendances.map((a) => {
                            const statusInfo = STATUS_MAP[a.status] || { label: a.status, color: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" };
                            const noteData = studentNotes[a.studentId] || { note: "", rating: null };

                            return (
                                <div key={a.studentId} className="px-5 py-4">
                                    {/* 학생 이름 + 출석 상태 */}
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-gray-900 dark:text-white">{a.studentName}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusInfo.color}`}>
                                            {statusInfo.label}
                                        </span>
                                    </div>

                                    {/* 참여도 평점 (별 1~5) */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">참여도:</span>
                                        <div className="flex gap-0.5">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    key={star}
                                                    onClick={() => updateRating(
                                                        a.studentId,
                                                        noteData.rating === star ? null : star
                                                    )}
                                                    className="focus:outline-none"
                                                >
                                                    <span
                                                        className={`material-symbols-outlined text-lg ${
                                                            noteData.rating && noteData.rating >= star
                                                                ? "text-yellow-400"
                                                                : "text-gray-300"
                                                        }`}
                                                        style={{
                                                            fontVariationSettings:
                                                                noteData.rating && noteData.rating >= star
                                                                    ? "'FILL' 1"
                                                                    : "'FILL' 0",
                                                        }}
                                                    >
                                                        star
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 개별 코멘트 */}
                                    <textarea
                                        value={noteData.note}
                                        onChange={(e) => updateNote(a.studentId, e.target.value)}
                                        placeholder="이 학생에 대한 코멘트를 작성하세요..."
                                        rows={2}
                                        className="w-full border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-sm focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime resize-y"
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 하단 버튼 바 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* 발행/발행취소 버튼 */}
                    <button
                        onClick={handleTogglePublish}
                        disabled={publishing}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1 ${
                            published
                                ? "bg-gray-200 text-gray-700 dark:text-gray-200 hover:bg-gray-300"
                                : "bg-green-600 text-white hover:bg-green-700"
                        } disabled:opacity-50`}
                    >
                        <span className="material-symbols-outlined text-base">
                            {published ? "unpublished" : "publish"}
                        </span>
                        {publishing ? "처리 중..." : published ? "발행 취소" : "학부모에게 발행"}
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    {saved && (
                        <span className="text-sm text-green-600 font-medium">저장 완료</span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-orange-600 transition disabled:opacity-50 flex items-center gap-1"
                    >
                        <span className="material-symbols-outlined text-base">save</span>
                        {saving ? "저장 중..." : "저장"}
                    </button>
                </div>
            </div>
        </div>
    );
}
