"use client";

import { useState } from "react";

type EnrollmentPreview = {
  className: string;
  classMatched: boolean;
  sourceRows: number[];
  siteClassId: string | null;
  siteDayOfWeek: string | null;
  siteStartTime: string | null;
  siteEnrollmentStatus: string | null;
};

type StudentPreview = {
  name: string;
  alias: string;
  sourceRows: number[];
  enrollments: EnrollmentPreview[];
  heldReasons: string[];
  status: "HELD" | "READY_FOR_SITE_REVIEW";
  siteMatch: {
    status: string;
    confidence: string | null;
    siteStudentId?: string;
    studentStatus?: string;
    existingEnrollments: { classId: string; className: string; status: string }[];
  };
};

type PreviewResponse = {
  readOnly: true;
  summary: {
    rowCount: number;
    studentCount: number;
    enrollmentCount: number;
    heldRowCount: number;
    matchedCount: number;
    notConfirmedCount: number;
  };
  students: StudentPreview[];
};

const REASON_LABELS: Record<string, string> = {
  IDENTITY_INSUFFICIENT: "학생을 구분할 신원 근거 부족",
  CLASS_MISSING: "반 정보 없음",
  CLASS_UNMATCHED: "사이트에 같은 이름의 반 없음",
  CLASS_AMBIGUOUS: "사이트에 같은 이름의 반이 여러 개",
  IDENTITY_BIRTH_CONFLICT: "같은 학생 후보의 생년월일이 서로 다름",
  NOT_FOUND_REVIEW: "사이트에서 일치 학생을 찾지 못함 (신규로 단정하지 않음)",
  MULTIPLE_SITE_MATCHES: "사이트에서 복수 학생이 일치함",
  IDENTITY_NOT_CONFIRMED: "이름 외 신원 근거로 사이트 학생을 확정하지 못함",
  IDENTITY_CONTACT_CONFLICT: "생년월일 일치 후보의 연락처가 다름",
  BIRTH_DATE_ONLY_REVIEW: "생년월일만 일치해 사람 검토 필요",
  OTHER_BRANCH_REVIEW: "다른 지점 기록만 있어 보류",
  SITE_BRANCH_UNCONFIRMED: "사이트 지점이 확인되지 않아 보류",
};

const MATCH_LABELS: Record<string, string> = {
  MATCHED_REVIEW: "사이트 학생 후보 일치",
  BIRTH_DATE_ONLY_REVIEW: "생년월일만 일치 · 연락처 검토 필요",
  NOT_FOUND_REVIEW: "사이트 일치 없음 · 확인 필요",
  MULTIPLE_SITE_MATCHES: "복수 후보 · 보류",
  IDENTITY_NOT_CONFIRMED: "신원 확인 필요 · 보류",
  IDENTITY_CONTACT_CONFLICT: "연락처 불일치 · 보류",
  IDENTITY_BIRTH_CONFLICT: "생년월일 불일치 · 보류",
  OTHER_BRANCH_REVIEW: "다른 지점 후보 · 보류",
  SITE_BRANCH_UNCONFIRMED: "지점 확인 필요 · 보류",
};

function classStatusLabel(status: string | null, identityMatched: boolean) {
  if (!identityMatched) return "학생 미확정 · 반 미대조";
  if (!status) return "사이트 반 등록 없음";
  if (status === "ACTIVE") return "사이트 재원";
  if (status === "PAUSED") return "사이트 휴원";
  if (status === "WITHDRAWN") return "사이트 퇴원";
  return `사이트 상태 ${status}`;
}

export default function RallyzRosterPreview() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPreview() {
    if (!file) {
      setError("Rallyz에서 내려받은 학생목록 엑셀을 선택해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/import-rallyz-roster-preview", {
        method: "POST",
        body: formData,
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "대조 미리보기를 만들지 못했습니다.");
      setPreview(data as PreviewResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "대조 미리보기를 만들지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-indigo-200 bg-white p-5 shadow-sm dark:border-indigo-500/30 dark:bg-gray-800">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Rallyz 재원 명단 · 사이트 대조</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          파일을 저장하지 않고 현재 학생·반 원장과 읽기 전용으로 비교합니다. 결제 정보는 대조 대상에서 제외되며, 이 화면은 등록이나 수정 작업을 하지 않습니다.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="file"
          accept=".xlsx"
          aria-label="Rallyz 학생목록 엑셀 파일 선택"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setPreview(null);
            setError(null);
          }}
          className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium dark:text-gray-200 dark:file:bg-gray-700"
        />
        <button
          type="button"
          onClick={() => void loadPreview()}
          disabled={loading || !file}
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "사이트와 대조 중…" : "읽기 전용 대조"}
        </button>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">{error}</p>}

      {preview && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Summary label="반 배정 행" value={preview.summary.rowCount} />
            <Summary label="학생 후보" value={preview.summary.studentCount} />
            <Summary label="반 배정 후보" value={preview.summary.enrollmentCount} />
            <Summary label="사이트 신원 일치" value={preview.summary.matchedCount} />
            <Summary label="신원 미확정" value={preview.summary.notConfirmedCount} />
            <Summary label="확인 보류 행" value={preview.summary.heldRowCount} />
          </div>
          <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-300">
                <tr>
                  <th className="px-3 py-2">엑셀 행</th>
                  <th className="px-3 py-2">학생</th>
                  <th className="px-3 py-2">사이트 학생 대조</th>
                  <th className="px-3 py-2">반 배정</th>
                  <th className="px-3 py-2">판정</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {preview.students.map((student, index) => (
                  <tr key={`${student.sourceRows.join(",")}-${index}`} className="align-top">
                    <td className="whitespace-nowrap px-3 py-3 text-gray-500">{student.sourceRows.join(", ")}</td>
                    <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">
                      {student.name || "이름 없음"}
                      {student.alias && <span className="ml-1 text-xs font-normal text-gray-500">({student.alias})</span>}
                    </td>
                    <td className="px-3 py-3">
                      <div>{MATCH_LABELS[student.siteMatch.status] ?? student.siteMatch.status}</div>
                      {student.siteMatch.siteStudentId && (
                        <div className="mt-1 text-xs text-gray-500">
                          사이트 ID …{student.siteMatch.siteStudentId.slice(-8)} · {student.siteMatch.confidence === "STRONG_PHONE" ? "연락처 일치" : "생년월일 일치 · 검토"}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {student.enrollments.length ? student.enrollments.map((enrollment, enrollmentIndex) => (
                        <div key={`${enrollment.className}-${enrollmentIndex}`} className="mb-1">
                          <span>{enrollment.className}</span>
                          <span className="ml-2 text-xs text-gray-500">{classStatusLabel(enrollment.siteEnrollmentStatus, student.siteMatch.status === "MATCHED_REVIEW")}</span>
                        </div>
                      )) : <span className="text-amber-700">반 정보 없음</span>}
                    </td>
                    <td className="px-3 py-3">
                      {student.status === "HELD" ? (
                        <ul className="list-inside list-disc text-xs text-amber-800 dark:text-amber-200">
                          {student.heldReasons.map((reason) => <li key={reason}>{REASON_LABELS[reason] ?? reason}</li>)}
                        </ul>
                      ) : <span className="text-green-700 dark:text-green-300">대조 완료 · 등록은 실행하지 않음</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            이 결과는 이관 검토용입니다. 신원 일치도 운영 반영 승인이 아니며, 신규 등록·반 추가·수강 상태 변경은 실행되지 않았습니다.
          </p>
        </>
      )}
    </section>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{value.toLocaleString()}</div>
    </div>
  );
}
