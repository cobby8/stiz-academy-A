"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, BookOpen, CalendarCheck, Plus, Camera } from "lucide-react";
import SessionLogModal, { type SessionInitialData } from "./SessionLogModal";

// 요일 한글 변환 맵
const DAY_LABELS: Record<string, string> = {
    Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};

// 출석 상태 라벨 + 색상 맵
const ATT_STATUS: Record<string, { label: string; color: string }> = {
    PRESENT: { label: "출석", color: "bg-green-100 text-green-700" },
    ABSENT: { label: "결석", color: "bg-red-100 text-red-700" },
    LATE: { label: "지각", color: "bg-yellow-100 text-yellow-700" },
    EXCUSED: { label: "사유결석", color: "bg-blue-100 text-blue-700" },
};

// 날짜를 YYYY-MM-DD 문자열로 변환하는 유틸리티 함수
function toDateStr(d: Date | string | null): string {
    if (!d) return "-";
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toISOString().split("T")[0];
}

// === 타입 정의 ===

// 반 정보 + 수강생 목록 (getClassWithStudents 반환값)
type ClassData = {
    id: string;
    name: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    capacity: number;
    slotKey: string | null;
    programName: string | null;
    programId: string | null;
    students: {
        enrollmentId: string;
        status: string;
        enrolledAt: Date | string;
        studentId: string;
        studentName: string;
        phone: string | null;
        school: string | null;
        grade: string | null;
        birthDate: Date | string | null;
        gender: string | null;
    }[];
};

// 수업 기록 (getSessionsByClass 반환값)
type SessionRow = {
    id: string;
    date: Date | string;
    topic: string | null;
    notes: string | null;
    photosJSON: string | null;
    coachId: string | null;
    coachName: string | null;
    attendanceCount: number;
    presentCount: number;
};

// 코치 정보 (getCoaches 반환값)
type Coach = {
    id: string;
    name: string;
    role: string | null;
};

// 탭 종류 — 3개 탭을 타입으로 제한
type TabKey = "students" | "sessions" | "attendance";

// === Props ===
type Props = {
    classData: ClassData;
    sessions: SessionRow[];
    coaches: Coach[];
};

export default function ClassDetailClient({ classData, sessions, coaches }: Props) {
    const router = useRouter();
    // 현재 활성 탭 상태 관리
    const [activeTab, setActiveTab] = useState<TabKey>("students");
    // SessionLogModal 표시 여부
    const [showSessionLog, setShowSessionLog] = useState(false);
    // 수정 모드일 때 기존 세션 데이터 (null이면 신규 모드)
    const [editingSession, setEditingSession] = useState<SessionInitialData | null>(null);
    // 세션 상세 로딩 상태
    const [loadingSession, setLoadingSession] = useState(false);

    // 수업 기록 추가 (신규 모드)
    const handleAddSession = useCallback(() => {
        setEditingSession(null);
        setShowSessionLog(true);
    }, []);

    // 수업 기록 수정 (수정 모드 — API로 상세 데이터 가져오기)
    const handleEditSession = useCallback(async (sessionId: string) => {
        setLoadingSession(true);
        try {
            const res = await fetch(`/api/admin/session-detail?sessionId=${sessionId}`);
            if (!res.ok) throw new Error("세션 데이터를 불러올 수 없습니다");
            const data = await res.json();
            setEditingSession(data as SessionInitialData);
            setShowSessionLog(true);
        } catch (err) {
            alert("세션 데이터를 불러오는 데 실패했습니다.");
        } finally {
            setLoadingSession(false);
        }
    }, []);

    // 저장 후 콜백 — 페이지 데이터 새로고침
    const handleSaved = useCallback(() => {
        router.refresh();
    }, [router]);

    // 탭 정의 — 아이콘 + 라벨 + 카운트
    const tabs: { key: TabKey; label: string; icon: typeof Users; count?: number }[] = [
        { key: "students", label: "학생 명단", icon: Users, count: classData.students.length },
        { key: "sessions", label: "수업 기록", icon: BookOpen, count: sessions.length },
        { key: "attendance", label: "출석 현황", icon: CalendarCheck },
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* ── 상단 헤더: 뒤로가기 + 반 정보 ── */}
            <div className="flex items-center gap-4">
                <Link href="/admin/classes" className="p-2 hover:bg-gray-100 dark:bg-gray-800 rounded-lg transition">
                    <ArrowLeft size={20} className="text-gray-500 dark:text-gray-400" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">
                        {classData.name}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {/* 프로그램명 + 요일/시간 + 수강생 수/정원 */}
                        {classData.programName && <span>{classData.programName} · </span>}
                        {DAY_LABELS[classData.dayOfWeek] || classData.dayOfWeek}요일{" "}
                        {classData.startTime}~{classData.endTime}
                        {" · "}
                        <span className="font-medium text-gray-700 dark:text-gray-200">
                            {classData.students.length}/{classData.capacity}명
                        </span>
                    </p>
                </div>
            </div>

            {/* ── 요약 카드 3개 ── */}
            <div className="grid grid-cols-3 gap-4">
                {/* 수강생 수 */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">수강생</p>
                    <p className="text-2xl font-extrabold text-gray-900 dark:text-white">
                        {classData.students.length}
                        <span className="text-sm font-normal text-gray-400">/{classData.capacity}</span>
                    </p>
                </div>
                {/* 수업 횟수 */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">수업 기록</p>
                    <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{sessions.length}회</p>
                </div>
                {/* 평균 출석률 */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">평균 출석률</p>
                    <p className="text-2xl font-extrabold text-gray-900 dark:text-white">
                        {/* 전체 세션의 출석률 평균 계산 */}
                        {sessions.length > 0
                            ? Math.round(
                                sessions.reduce((sum, s) =>
                                    sum + (s.attendanceCount > 0 ? (s.presentCount / s.attendanceCount) * 100 : 0)
                                , 0) / sessions.length
                              )
                            : 0}%
                    </p>
                </div>
            </div>

            {/* ── 탭 네비게이션 ── */}
            <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex gap-6">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium border-b-2 transition ${
                                    isActive
                                        ? "border-brand-orange-500 dark:border-brand-neon-lime text-brand-orange-500 dark:text-brand-neon-lime"
                                        : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-200"
                                }`}
                            >
                                <Icon size={16} />
                                {tab.label}
                                {/* 카운트 뱃지 */}
                                {tab.count !== undefined && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                        isActive ? "bg-orange-100 text-orange-700" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                    }`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* ── 탭 콘텐츠 ── */}
            <div>
                {activeTab === "students" && <StudentsTab students={classData.students} />}
                {activeTab === "sessions" && (
                    <SessionsTab
                        sessions={sessions}
                        onAddSession={handleAddSession}
                        onEditSession={handleEditSession}
                        loadingSession={loadingSession}
                    />
                )}
                {activeTab === "attendance" && <AttendanceTab sessions={sessions} />}
            </div>

            {/* 수업 기록 모달 (신규/수정 모드) */}
            <SessionLogModal
                isOpen={showSessionLog}
                onClose={() => {
                    setShowSessionLog(false);
                    setEditingSession(null);
                }}
                classId={classData.id}
                initialData={editingSession ?? undefined}
                coaches={coaches.map((c) => ({ id: c.id, name: c.name }))}
                students={classData.students.map((s) => ({
                    id: s.studentId,
                    name: s.studentName,
                    gender: s.gender,
                }))}
                onSaved={handleSaved}
            />
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// 학생 명단 탭
// ────────────────────────────────────────────────────────────────────────────
function StudentsTab({ students }: { students: ClassData["students"] }) {
    if (students.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 text-center">
                <Users size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">등록된 수강생이 없습니다</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                            <th className="text-left py-3 px-4 text-xs text-gray-500 dark:text-gray-400 font-medium">이름</th>
                            <th className="text-left py-3 px-4 text-xs text-gray-500 dark:text-gray-400 font-medium">성별</th>
                            <th className="text-left py-3 px-4 text-xs text-gray-500 dark:text-gray-400 font-medium">학교</th>
                            <th className="text-left py-3 px-4 text-xs text-gray-500 dark:text-gray-400 font-medium">학년</th>
                            <th className="text-left py-3 px-4 text-xs text-gray-500 dark:text-gray-400 font-medium">연락처</th>
                            <th className="text-left py-3 px-4 text-xs text-gray-500 dark:text-gray-400 font-medium">등록일</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((s) => (
                            <tr key={s.enrollmentId} className="border-b border-gray-50 hover:bg-gray-50 dark:bg-gray-900 transition">
                                {/* 학생 이름 — 클릭하면 학생 상세 페이지로 이동 */}
                                <td className="py-3 px-4">
                                    <Link
                                        href={`/admin/students/${s.studentId}`}
                                        className="font-medium text-gray-900 hover:text-brand-orange-500 dark:text-brand-neon-lime transition"
                                    >
                                        {s.studentName}
                                    </Link>
                                </td>
                                <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{s.gender || "-"}</td>
                                <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{s.school || "-"}</td>
                                <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{s.grade || "-"}</td>
                                <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{s.phone || "-"}</td>
                                <td className="py-3 px-4 text-gray-500 dark:text-gray-400">{toDateStr(s.enrolledAt)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// 수업 기록 탭
// ────────────────────────────────────────────────────────────────────────────
function SessionsTab({ sessions, onAddSession, onEditSession, loadingSession }: {
    sessions: SessionRow[];
    onAddSession: () => void;
    onEditSession: (sessionId: string) => void;
    loadingSession: boolean;
}) {
    return (
        <div className="space-y-4">
            {/* 상단: 수업 기록 추가 버튼 */}
            <div className="flex justify-end">
                <button
                    onClick={onAddSession}
                    className="flex items-center gap-2 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-orange-600 transition"
                >
                    <Plus size={16} />
                    수업 기록 추가
                </button>
            </div>

            {sessions.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 text-center">
                    <BookOpen size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">수업 기록이 없습니다</p>
                    <p className="text-xs text-gray-400 mt-1">위 버튼으로 첫 수업을 기록해보세요</p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {sessions.map((s) => {
                        // 출석률 계산: (출석 인원 / 전체 출석 기록) * 100
                        const rate = s.attendanceCount > 0
                            ? Math.round((s.presentCount / s.attendanceCount) * 100)
                            : 0;

                        // photosJSON 파싱하여 첫 번째 사진 URL 추출
                        let firstPhotoUrl: string | null = null;
                        if (s.photosJSON) {
                            try {
                                const photos = JSON.parse(s.photosJSON);
                                if (Array.isArray(photos) && photos.length > 0) {
                                    // photos가 문자열 배열이면 첫 번째 요소, 객체 배열이면 url 프로퍼티
                                    firstPhotoUrl = typeof photos[0] === "string" ? photos[0] : photos[0]?.url ?? null;
                                }
                            } catch {
                                // JSON 파싱 실패 시 무시
                            }
                        }

                        return (
                            <div
                                key={s.id}
                                onClick={() => onEditSession(s.id)}
                                className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 flex gap-4 hover:shadow-md transition cursor-pointer ${
                                    loadingSession ? "opacity-50 pointer-events-none" : ""
                                }`}
                            >
                                {/* 사진 썸네일 — 사진이 있을 때만 표시 */}
                                {firstPhotoUrl && (
                                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                                        <img
                                            src={firstPhotoUrl}
                                            alt="수업 사진"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                )}
                                {/* 사진 없을 때 아이콘 placeholder */}
                                {!firstPhotoUrl && (
                                    <div className="w-20 h-20 rounded-xl bg-gray-50 dark:bg-gray-900 flex-shrink-0 flex items-center justify-center">
                                        <Camera size={24} className="text-gray-300" />
                                    </div>
                                )}

                                {/* 수업 기록 텍스트 정보 */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-gray-900 dark:text-white">{toDateStr(s.date)}</span>
                                        {s.coachName && (
                                            <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                                                {s.coachName} 코치
                                            </span>
                                        )}
                                    </div>
                                    {/* 수업 주제 */}
                                    {s.topic && (
                                        <p className="text-sm text-gray-700 dark:text-gray-200 font-medium truncate">{s.topic}</p>
                                    )}
                                    {/* 출석률 바 */}
                                    <div className="flex items-center gap-2 mt-2">
                                        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 max-w-[120px]">
                                            <div
                                                className="bg-green-500 rounded-full h-1.5 transition-all"
                                                style={{ width: `${rate}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            출석 {s.presentCount}/{s.attendanceCount}명 ({rate}%)
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// 출석 현황 탭 — 각 세션별 출석 요약 목록
// ────────────────────────────────────────────────────────────────────────────
function AttendanceTab({ sessions }: { sessions: SessionRow[] }) {
    if (sessions.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 text-center">
                <CalendarCheck size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">출석 기록이 없습니다</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                            <th className="text-left py-3 px-4 text-xs text-gray-500 dark:text-gray-400 font-medium">날짜</th>
                            <th className="text-left py-3 px-4 text-xs text-gray-500 dark:text-gray-400 font-medium">코치</th>
                            <th className="text-left py-3 px-4 text-xs text-gray-500 dark:text-gray-400 font-medium">출석</th>
                            <th className="text-left py-3 px-4 text-xs text-gray-500 dark:text-gray-400 font-medium">결석/지각</th>
                            <th className="text-left py-3 px-4 text-xs text-gray-500 dark:text-gray-400 font-medium">출석률</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessions.map((s) => {
                            // 출석률 계산
                            const rate = s.attendanceCount > 0
                                ? Math.round((s.presentCount / s.attendanceCount) * 100)
                                : 0;
                            // 결석/지각 수 = 전체 출석 기록 - 출석 인원
                            const absentOrLate = s.attendanceCount - s.presentCount;

                            return (
                                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 dark:bg-gray-900 transition">
                                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{toDateStr(s.date)}</td>
                                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{s.coachName || "-"}</td>
                                    <td className="py-3 px-4">
                                        <span className="text-green-700 font-medium">{s.presentCount}명</span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className={absentOrLate > 0 ? "text-red-600 font-medium" : "text-gray-400"}>
                                            {absentOrLate}명
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        {/* 출석률에 따라 색상 변경 */}
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                            rate >= 80
                                                ? "bg-green-100 text-green-700"
                                                : rate >= 50
                                                    ? "bg-yellow-100 text-yellow-700"
                                                    : "bg-red-100 text-red-700"
                                        }`}>
                                            {rate}%
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
