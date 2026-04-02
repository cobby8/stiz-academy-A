"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ExcelUploadModal from "./ExcelUploadModal";
import {
    createStudent,
    updateStudent,
    deleteStudent,
    enrollStudent,
    deleteEnrollment,
} from "@/app/actions/admin";

type Student = {
    id: string;
    name: string;
    birthDate: Date | string;
    gender: string | null;
    parentId: string;
    // 새 필드: 엑셀 업로드 일괄 등록용
    phone: string | null;       // 학생 휴대폰번호
    school: string | null;      // 학교명
    grade: string | null;       // 학년
    address: string | null;     // 주소
    enrollDate: Date | string | null;  // 입회일자
    createdAt: Date | string;
    parent: {
        name: string | null;
        phone: string | null;
        email: string | null;
    };
    // 수강 정보 (getStudents 서브쿼리에서 가져옴)
    enrollments: {
        classId: string;
        className: string;
        status: string;
        dayOfWeek: string;
        startTime: string;
        createdAt?: string;
    }[];
};

type ClassItem = {
    id: string;
    name: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    slotKey: string | null; // 시간표 슬롯 키 (예: "Mon-4")
    program: { id: string; name: string } | null;
};

const DAY_LABELS: Record<string, string> = {
    Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일",
};

// 요일 정렬 순서 (월~일)
const DAY_ORDER: Record<string, number> = {
    Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

// 요일 전체 라벨 (수강 등록 모달에서 사용)
const DAY_FULL_LABELS: Record<string, string> = {
    Mon: "월요일", Tue: "화요일", Wed: "수요일", Thu: "목요일",
    Fri: "금요일", Sat: "토요일", Sun: "일요일",
};

/**
 * slotKey에서 교시 번호를 추출하는 유틸 함수
 * 예: "Mon-4" → 4, "Sat-2" → 2, "custom-xxx" → 999 (커스텀은 맨 뒤로)
 */
function getPeriodFromSlotKey(slotKey: string | null): number {
    if (!slotKey) return 999;
    const match = slotKey.match(/-(\d+)$/);
    return match ? parseInt(match[1], 10) : 999;
}

/**
 * Class 목록을 프로그램별로 그룹화하고, 각 그룹 안에서 요일+교시 순으로 정렬
 * 반환: { programName: string, classes: ClassItem[] }[]
 */
function groupClassesByProgram(classes: ClassItem[]) {
    // 프로그램별로 그룹핑
    const groups = new Map<string, { programName: string; classes: ClassItem[] }>();

    for (const c of classes) {
        const key = c.program?.id ?? "__no_program__";
        const name = c.program?.name ?? "미지정 프로그램";
        if (!groups.has(key)) {
            groups.set(key, { programName: name, classes: [] });
        }
        groups.get(key)!.classes.push(c);
    }

    // 각 그룹 안에서 요일 + 교시 순으로 정렬
    for (const group of groups.values()) {
        group.classes.sort((a, b) => {
            const dayDiff = (DAY_ORDER[a.dayOfWeek] ?? 99) - (DAY_ORDER[b.dayOfWeek] ?? 99);
            if (dayDiff !== 0) return dayDiff;
            return getPeriodFromSlotKey(a.slotKey) - getPeriodFromSlotKey(b.slotKey);
        });
    }

    return Array.from(groups.values());
}

function toDateStr(d: Date | string | null): string {
    if (!d) return "";
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toISOString().split("T")[0];
}

function calcAge(birthDate: Date | string): number {
    const birth = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

/**
 * 학년 문자열을 간결하게 변환하는 유틸 함수
 * "2026년 초등 4학년" -> "초4", "2026년 중등 1학년" -> "중1", "성인" -> "성인"
 */
function shortenGrade(grade: string | null): string {
    if (!grade) return "-";
    if (grade === "성인") return "성인";
    // "초등 N학년" 패턴 매칭 (연도 접두사 무시)
    const elemMatch = grade.match(/초등\s*(\d)/);
    if (elemMatch) return `초${elemMatch[1]}`;
    // "중등 N학년" 패턴 매칭
    const midMatch = grade.match(/중등\s*(\d)/);
    if (midMatch) return `중${midMatch[1]}`;
    // "고등 N학년" 패턴 매칭
    const highMatch = grade.match(/고등\s*(\d)/);
    if (highMatch) return `고${highMatch[1]}`;
    // 매칭 안 되면 원본 그대로
    return grade;
}

/**
 * 수강 반 이름을 간결하게 변환: "월요일 6교시" -> "월6"
 * slotKey가 있으면 slotKey(예: "Mon-4") 활용, 없으면 className에서 추출
 */
function shortenClassName(enrollment: { dayOfWeek: string; className: string; slotKey?: string | null }): string {
    const dayLabel = DAY_LABELS[enrollment.dayOfWeek] || enrollment.dayOfWeek;
    // slotKey에서 교시 번호 추출 (예: "Mon-4" -> 4)
    if (enrollment.slotKey) {
        const match = enrollment.slotKey.match(/-(\d+)$/);
        if (match) return `${dayLabel}${match[1]}`;
    }
    // className에서 교시 번호 추출 (예: "월요일 6교시" -> 6)
    const periodMatch = enrollment.className.match(/(\d+)\s*교시/);
    if (periodMatch) return `${dayLabel}${periodMatch[1]}`;
    // 추출 실패 시 요일 + 반이름 축약
    return `${dayLabel}`;
}

/**
 * 전화번호에 하이픈 포맷 적용: "01052594903" -> "010-5259-4903"
 */
function formatPhone(phone: string | null): string {
    if (!phone) return "-";
    // 이미 하이픈이 있으면 그대로 반환
    if (phone.includes("-")) return phone;
    // 숫자만 추출
    const digits = phone.replace(/\D/g, "");
    // 010-XXXX-XXXX (11자리)
    if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    // 02-XXXX-XXXX (10자리, 서울)
    if (digits.length === 10 && digits.startsWith("02")) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    // 0XX-XXX-XXXX (10자리, 지역번호)
    if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    return phone;
}

/**
 * 학부모 이름을 간결하게 표시
 * "기타(기본 보호자)" -> "보호자", "기타(본인)" -> "본인"
 */
function shortenParentName(name: string | null): string {
    if (!name) return "-";
    if (name === "기타(기본 보호자)" || name === "기본 보호자") return "보호자";
    if (name === "기타(본인)") return "본인";
    // "기타(...)" 패턴에서 괄호 안의 내용만 추출
    const etcMatch = name.match(/^기타\((.+)\)$/);
    if (etcMatch) return etcMatch[1];
    return name;
}

/**
 * 학생의 대표 상태를 판단하는 헬퍼 함수
 * - ACTIVE가 1개라도 있으면 "ACTIVE" (활성 수강이 있으니까)
 * - 없으면 가장 최근 enrollment의 status를 사용
 */
function getLatestStatus(enrollments: Student["enrollments"]): string | null {
    if (!enrollments || enrollments.length === 0) return null;
    // ACTIVE가 하나라도 있으면 활성
    if (enrollments.some((e) => e.status === "ACTIVE")) return "ACTIVE";
    // 없으면 가장 최근 생성된 enrollment의 상태를 기준으로 판단
    const sorted = [...enrollments].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA; // 최신순
    });
    return sorted[0].status;
}

export default function StudentManagementClient({
    students,
    classes,
}: {
    students: Student[];
    classes: ClassItem[];
}) {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [enrollModal, setEnrollModal] = useState<string | null>(null);
    // 엑셀 업로드 모달 열기/닫기 상태
    const [showExcelUpload, setShowExcelUpload] = useState(false);

    // 필터 상태: 반/학년/학교/수강상태
    const [filterClass, setFilterClass] = useState("");
    const [filterGrade, setFilterGrade] = useState("");
    const [filterSchool, setFilterSchool] = useState("");
    // 기본 필터를 "활성"으로 설정 — 대부분 수강 중인 학생을 먼저 봄
    const [filterStatus, setFilterStatus] = useState("ACTIVE");

    // 필터 선택지: 학생 데이터에서 고유값 추출 (useMemo로 캐싱)
    const gradeOptions = useMemo(() => {
        const set = new Set<string>();
        students.forEach((s) => { if (s.grade) set.add(s.grade); });
        return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
    }, [students]);

    const schoolOptions = useMemo(() => {
        const set = new Set<string>();
        students.forEach((s) => { if (s.school) set.add(s.school); });
        return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
    }, [students]);

    // Form state
    const [name, setName] = useState("");
    const [birthDate, setBirthDate] = useState("");
    const [gender, setGender] = useState("");
    const [parentName, setParentName] = useState("");
    const [parentPhone, setParentPhone] = useState("");
    const [parentEmail, setParentEmail] = useState("");
    // 개인정보보호법 준수: 보호자 동의 확인 체크박스 (미성년자 개인정보 수집 시 필수)
    const [guardianConsent, setGuardianConsent] = useState(false);

    function resetForm() {
        setName("");
        setBirthDate("");
        setGender("");
        setParentName("");
        setParentPhone("");
        setParentEmail("");
        setGuardianConsent(false);
        setShowForm(false);
        setEditingId(null);
    }

    function startEdit(s: Student) {
        setName(s.name);
        setBirthDate(toDateStr(s.birthDate));
        setGender(s.gender || "");
        setParentName(s.parent.name || "");
        setParentPhone(s.parent.phone || "");
        setParentEmail(s.parent.email || "");
        setEditingId(s.id);
        setShowForm(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim() || !birthDate || !parentName.trim()) return;
        // 신규 등록 시 보호자 동의 필수 (개인정보보호법: 미성년자 정보 수집 시 법정대리인 동의)
        if (!editingId && !guardianConsent) {
            alert("보호자 개인정보 수집 동의를 확인해주세요.");
            return;
        }
        setBusy(true);
        try {
            if (editingId) {
                await updateStudent(editingId, {
                    name: name.trim(),
                    birthDate,
                    gender: gender || null,
                    parentName: parentName.trim(),
                    parentPhone: parentPhone.trim() || null,
                });
            } else {
                await createStudent({
                    name: name.trim(),
                    birthDate,
                    gender: gender || null,
                    parentName: parentName.trim(),
                    parentPhone: parentPhone.trim() || null,
                    parentEmail: parentEmail.trim() || null,
                });
            }
            resetForm();
            router.refresh();
        } catch (err: any) {
            alert(err.message || "저장 실패");
        } finally {
            setBusy(false);
        }
    }

    async function handleDelete(id: string) {
        setBusy(true);
        try {
            await deleteStudent(id);
            setDeleteConfirm(null);
            router.refresh();
        } catch (err: any) {
            alert(err.message || "삭제 실패");
        } finally {
            setBusy(false);
        }
    }

    async function handleEnroll(studentId: string, classId: string) {
        setBusy(true);
        try {
            await enrollStudent(studentId, classId);
            setEnrollModal(null);
            router.refresh();
        } catch (err: any) {
            alert(err.message || "수강 등록 실패");
        } finally {
            setBusy(false);
        }
    }

    // 상태별 학생 수 집계 (요약 카드용)
    // 최신 enrollment 기준으로 학생의 대표 상태를 판단
    const statusCounts = useMemo(() => {
        let active = 0;
        let paused = 0;
        let withdrawn = 0;
        let noEnrollment = 0;

        for (const s of students) {
            const status = getLatestStatus(s.enrollments);
            if (!status) {
                noEnrollment++;
            } else if (status === "ACTIVE") {
                active++;
            } else if (status === "PAUSED") {
                paused++;
            } else if (status === "WITHDRAWN") {
                withdrawn++;
            } else {
                noEnrollment++;
            }
        }

        return { active, paused, withdrawn, noEnrollment, total: students.length };
    }, [students]);

    // 검색 + 필터 조합 (AND 조건): useMemo로 캐싱하여 불필요한 재계산 방지
    // 결과를 이름 가나다순으로 정렬
    const filtered = useMemo(() => {
        const result = students.filter((s) => {
            // 텍스트 검색
            if (search) {
                const q = search.toLowerCase();
                const matchSearch =
                    s.name.toLowerCase().includes(q) ||
                    (s.parent.name && s.parent.name.toLowerCase().includes(q)) ||
                    (s.parent.phone && s.parent.phone.includes(q)) ||
                    (s.school && s.school.toLowerCase().includes(q));
                if (!matchSearch) return false;
            }
            // 반(Class) 필터: 해당 반에 수강 중인 학생만
            if (filterClass) {
                const hasClass = s.enrollments?.some((e) => e.classId === filterClass);
                if (!hasClass) return false;
            }
            // 학년 필터
            if (filterGrade && s.grade !== filterGrade) return false;
            // 학교 필터
            if (filterSchool && s.school !== filterSchool) return false;
            // 수강 상태 필터: 최신 enrollment 상태 기준으로 판단
            if (filterStatus) {
                const latestStatus = getLatestStatus(s.enrollments);
                if (filterStatus === "NONE") {
                    if (latestStatus !== null) return false;
                } else {
                    if (latestStatus !== filterStatus) return false;
                }
            }
            return true;
        });
        // 이름 가나다순 정렬 (기본 정렬)
        result.sort((a, b) => a.name.localeCompare(b.name, "ko"));
        return result;
    }, [students, search, filterClass, filterGrade, filterSchool, filterStatus]);

    return (
        <div className="max-w-5xl mx-auto">
            {/* 상태별 요약 카드 — 클릭하면 해당 필터 적용 */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-6">
                {[
                    { label: "활성", value: "ACTIVE", count: statusCounts.active, color: "bg-emerald-50 border-emerald-200 text-emerald-700", icon: "person" },
                    { label: "휴원", value: "PAUSED", count: statusCounts.paused, color: "bg-amber-50 border-amber-200 text-amber-700", icon: "pause_circle" },
                    { label: "퇴원", value: "WITHDRAWN", count: statusCounts.withdrawn, color: "bg-red-50 border-red-200 text-red-700", icon: "person_off" },
                    { label: "미배정", value: "NONE", count: statusCounts.noEnrollment, color: "bg-purple-50 border-purple-200 text-purple-700", icon: "help_outline" },
                    { label: "전체", value: "", count: statusCounts.total, color: "bg-gray-50 border-gray-200 text-gray-700", icon: "groups" },
                ].map((card) => (
                    <button
                        key={card.label}
                        onClick={() => setFilterStatus(card.value)}
                        className={`rounded-xl border p-3 text-left transition hover:shadow-sm ${card.color} ${
                            filterStatus === card.value ? "ring-2 ring-brand-orange-500 shadow-sm" : ""
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg">{card.icon}</span>
                            <span className="text-xs font-medium opacity-70">{card.label}</span>
                        </div>
                        <p className="text-2xl font-extrabold mt-1">{card.count}명</p>
                    </button>
                ))}
            </div>

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900">원생 관리</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        {filterStatus === "ACTIVE" ? "수강 중인" : filterStatus === "PAUSED" ? "휴원 중인" : filterStatus === "WITHDRAWN" ? "퇴원한" : filterStatus === "NONE" ? "미배정" : "전체"} 원생: {filtered.length}명
                    </p>
                </div>
                <div className="flex gap-2">
                    {/* 엑셀 일괄 업로드 버튼 — 랠리즈 다운로드 파일용 */}
                    <button
                        onClick={() => setShowExcelUpload(true)}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-700 transition"
                    >
                        엑셀 업로드
                    </button>
                    {/* 기존 1명씩 수동 등록 버튼 */}
                    <button
                        onClick={() => { resetForm(); setShowForm(true); }}
                        className="bg-brand-orange-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-600 transition"
                    >
                        + 원생 등록
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="이름, 학부모명, 전화번호, 학교명으로 검색..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full max-w-md border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500"
                />
            </div>

            {/* 필터 드롭다운: 반/학년/학교/상태를 가로 1줄로 배치 */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                {/* 반(Class) 필터 */}
                <select
                    value={filterClass}
                    onChange={(e) => setFilterClass(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-orange-500"
                >
                    <option value="">전체 반</option>
                    {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name} ({DAY_LABELS[c.dayOfWeek] || c.dayOfWeek} {c.startTime})
                        </option>
                    ))}
                </select>
                {/* 학년 필터 */}
                <select
                    value={filterGrade}
                    onChange={(e) => setFilterGrade(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-orange-500"
                >
                    <option value="">전체 학년</option>
                    {gradeOptions.map((g) => (
                        <option key={g} value={g}>{g}</option>
                    ))}
                </select>
                {/* 학교 필터 */}
                <select
                    value={filterSchool}
                    onChange={(e) => setFilterSchool(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-orange-500"
                >
                    <option value="">전체 학교</option>
                    {schoolOptions.map((sc) => (
                        <option key={sc} value={sc}>{sc}</option>
                    ))}
                </select>
                {/* 수강 상태 필터 */}
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-orange-500"
                >
                    <option value="">전체 상태</option>
                    <option value="ACTIVE">활성</option>
                    <option value="PAUSED">휴원</option>
                    <option value="WITHDRAWN">퇴원</option>
                    <option value="NONE">미배정</option>
                </select>
                {/* 초기화 버튼: 필터가 하나라도 설정돼 있으면 표시 */}
                {(filterClass || filterGrade || filterSchool || filterStatus) && (
                    <button
                        onClick={() => {
                            setFilterClass("");
                            setFilterGrade("");
                            setFilterSchool("");
                            setFilterStatus("");
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                        초기화
                    </button>
                )}
            </div>

            {/* Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm space-y-4">
                    <h3 className="font-bold text-lg text-gray-900">{editingId ? "원생 수정" : "새 원생 등록"}</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">이름 *</label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                placeholder="홍길동"
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">생년월일 *</label>
                            <input
                                type="date"
                                min="1950-01-01" max="2025-12-31"
                                value={birthDate}
                                onChange={(e) => setBirthDate(e.target.value)}
                                required
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">성별</label>
                            <select
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500"
                            >
                                <option value="">선택 안함</option>
                                <option value="남">남</option>
                                <option value="여">여</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">학부모 이름 *</label>
                            <input
                                value={parentName}
                                onChange={(e) => setParentName(e.target.value)}
                                required
                                placeholder="보호자 이름"
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">학부모 연락처</label>
                            <input
                                value={parentPhone}
                                onChange={(e) => setParentPhone(e.target.value)}
                                placeholder="010-0000-0000"
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500"
                            />
                        </div>
                        {!editingId && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">학부모 이메일</label>
                                <input
                                    type="email"
                                    value={parentEmail}
                                    onChange={(e) => setParentEmail(e.target.value)}
                                    placeholder="parent@email.com"
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500"
                                />
                            </div>
                        )}
                    </div>

                    {/* 신규 등록 시에만 보호자 동의 확인 체크박스 표시 (수정 시에는 불필요) */}
                    {!editingId && (
                        <div className="border-t border-gray-100 pt-4">
                            <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={guardianConsent}
                                    onChange={(e) => setGuardianConsent(e.target.checked)}
                                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-orange-500 focus:ring-brand-orange-500"
                                />
                                <span className="text-sm text-gray-700">
                                    보호자로부터 <strong>개인정보 수집 및 이용 동의</strong>를 받았음을 확인합니다
                                    <span className="text-red-500 ml-1">(필수)</span>
                                </span>
                            </label>
                            <p className="text-xs text-gray-400 mt-1 ml-6">
                                미성년자 개인정보 수집 시 법정대리인(보호자)의 동의가 필요합니다.
                            </p>
                        </div>
                    )}

                    <div className="flex gap-2 justify-end">
                        <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={busy || (!editingId && !guardianConsent)}
                            className="bg-brand-orange-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-orange-600 transition disabled:opacity-50"
                        >
                            {busy ? "저장 중..." : editingId ? "수정" : "등록"}
                        </button>
                    </div>
                </form>
            )}

            {/* Student list */}
            {filtered.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                    {search ? "검색 결과가 없습니다." : "등록된 원생이 없습니다. \"원생 등록\" 버튼으로 새 원생을 등록하세요."}
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">학년</th>
                                    {/* 학교/학부모/연락처: 모바일에서 숨김 */}
                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">학교</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">수강 반</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">학부모</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">연락처</th>
                                    <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filtered.map((s) => (
                                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                                        {/* 이름: 항상 표시, 클릭하면 상세 페이지로 이동 */}
                                        <td className="px-4 py-2">
                                            <Link href={`/admin/students/${s.id}`} className="font-bold text-gray-900 hover:text-brand-orange-500 transition-colors text-sm">
                                                {s.name}
                                            </Link>
                                        </td>
                                        {/* 학년: 항상 표시, shortenGrade로 "초4" 형태 */}
                                        <td className="px-4 py-2 text-sm text-gray-600">
                                            {shortenGrade(s.grade)}
                                        </td>
                                        {/* 학교: 모바일 숨김 */}
                                        <td className="px-4 py-2 text-sm text-gray-600 hidden md:table-cell">
                                            {s.school || "-"}
                                        </td>
                                        {/* 수강 반: 항상 표시, shortenClassName으로 "월6" 형태 */}
                                        <td className="px-4 py-2 text-sm text-gray-600">
                                            {s.enrollments && s.enrollments.length > 0
                                                ? [...s.enrollments]
                                                    .sort((a, b) => (DAY_ORDER[a.dayOfWeek] ?? 99) - (DAY_ORDER[b.dayOfWeek] ?? 99) || a.startTime.localeCompare(b.startTime))
                                                    .map((e) => shortenClassName(e)).join(", ")
                                                : <span className="text-gray-300">-</span>
                                            }
                                        </td>
                                        {/* 학부모: 모바일 숨김, shortenParentName으로 간결화 */}
                                        <td className="px-4 py-2 text-sm text-gray-600 hidden md:table-cell">
                                            {shortenParentName(s.parent.name)}
                                        </td>
                                        {/* 연락처: 모바일 숨김, formatPhone으로 하이픈 포맷 */}
                                        <td className="px-4 py-2 text-sm text-gray-600 hidden md:table-cell">
                                            {formatPhone(s.parent.phone)}
                                        </td>
                                        {/* 관리: 아이콘 버튼 3개 (수강등록, 수정, 삭제) */}
                                        <td className="px-4 py-2 text-right">
                                            <div className="flex items-center gap-1 justify-end">
                                                <button
                                                    onClick={() => setEnrollModal(s.id)}
                                                    title="수강등록"
                                                    className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
                                                </button>
                                                <button
                                                    onClick={() => startEdit(s)}
                                                    title="수정"
                                                    className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                                </button>
                                                {deleteConfirm === s.id ? (
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => handleDelete(s.id)}
                                                            disabled={busy}
                                                            className="text-xs bg-red-500 text-white px-2 py-1 rounded font-bold disabled:opacity-50"
                                                        >
                                                            확인
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirm(null)}
                                                            className="text-xs text-gray-500 px-2 py-1"
                                                        >
                                                            취소
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setDeleteConfirm(s.id)}
                                                        title="삭제"
                                                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 엑셀 업로드 모달 — 파일 선택 -> 미리보기 -> 일괄 등록 */}
            <ExcelUploadModal
                isOpen={showExcelUpload}
                onClose={() => setShowExcelUpload(false)}
                onComplete={() => {
                    setShowExcelUpload(false);
                    router.refresh(); // 목록 새로고침
                }}
            />

            {/* 수강 등록 모달 — 프로그램별 그룹화 + 요일/시간 표시 */}
            {enrollModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
                        <h3 className="font-bold text-lg text-gray-900 mb-4">
                            수강 등록 — {students.find(s => s.id === enrollModal)?.name}
                        </h3>
                        {classes.length === 0 ? (
                            <p className="text-gray-500 text-sm">개설된 반이 없습니다. 먼저 반을 개설하세요.</p>
                        ) : (
                            <div className="max-h-[60vh] overflow-y-auto space-y-4">
                                {/* 프로그램별 그룹으로 표시 */}
                                {groupClassesByProgram(classes).map((group) => (
                                    <div key={group.programName}>
                                        {/* 프로그램명 헤더 */}
                                        <div className="bg-gray-100 rounded-lg px-3 py-1.5 mb-2">
                                            <span className="text-sm font-bold text-gray-700">
                                                {group.programName}
                                            </span>
                                            <span className="text-xs text-gray-400 ml-2">
                                                ({group.classes.length}개 반)
                                            </span>
                                        </div>
                                        {/* 해당 프로그램의 클래스 목록 */}
                                        <div className="space-y-1 pl-2">
                                            {group.classes.map((c) => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => handleEnroll(enrollModal!, c.id)}
                                                    disabled={busy}
                                                    className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-brand-orange-400 hover:bg-orange-50 transition disabled:opacity-50"
                                                >
                                                    {/* 요일 + 교시명 + 시간 표시 */}
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium text-gray-900 text-sm">
                                                            {c.name}
                                                        </span>
                                                        <span className="text-xs text-gray-400">
                                                            {c.startTime}~{c.endTime}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-4 text-right">
                            <button
                                onClick={() => setEnrollModal(null)}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
