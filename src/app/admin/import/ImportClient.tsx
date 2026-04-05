"use client";

/**
 * 수강생 데이터 이관 클라이언트 UI
 *
 * 3단계 워크플로:
 * 1. CSV 업로드 (텍스트 붙여넣기 또는 파일 업로드)
 * 2. 미리보기 (파싱 결과 확인 + 요약 통계)
 * 3. 실행 (DB 삽입 + 결과 확인)
 */

import { useState, useCallback } from "react";

// ──────────────────────────────────────────────
// 타입 정의 (API 응답과 동일)
// ──────────────────────────────────────────────

interface TransformedStudent {
  parentName: string;
  parentPhone: string;
  name: string;
  birthDate: string | null;
  phone: string | null;
  school: string | null;
  grade: string | null;
  address: string | null;
  status: "ACTIVE" | "PAUSED" | "WITHDRAWN";
  paymentMethod: "RALLYZ" | "CARD" | "CASH" | "UNPAID" | null;
  amount: number | null;
  slotKeys: string[];
  rowNumber: number;
  branch: string;
}

interface PreviewSummary {
  totalRows: number;
  uniqueStudents: number;
  activeCount: number;
  pausedCount: number;
  withdrawnCount: number;
  branch1Count: number;
  branch2Count: number;
}

interface PreviewResult {
  students: TransformedStudent[];
  summary: PreviewSummary;
  errors: { rowNumber: number; reason: string }[];
}

interface ImportResultData {
  created: { users: number; students: number; enrollments: number; payments: number };
  skipped: { users: number; students: number; enrollments: number; payments: number };
  failed: { rowNumber: number; name: string; reason: string }[];
}

// ──────────────────────────────────────────────
// 상태 상수
// ──────────────────────────────────────────────

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  ACTIVE: { text: "재원", color: "bg-green-100 text-green-800" },
  PAUSED: { text: "휴원", color: "bg-yellow-100 text-yellow-800" },
  WITHDRAWN: { text: "퇴원", color: "bg-red-100 text-red-800" },
};

const METHOD_LABEL: Record<string, string> = {
  RALLYZ: "랠리즈",
  CARD: "카드",
  CASH: "현금",
  UNPAID: "미결제",
};

// ──────────────────────────────────────────────
// 메인 컴포넌트
// ──────────────────────────────────────────────

export default function ImportClient() {
  // 단계 관리: upload → preview → result
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");

  // CSV 텍스트 (붙여넣기 또는 파일에서 읽음)
  const [csvText, setCsvText] = useState("");

  // 미리보기 결과
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  // 실행 결과
  const [importResult, setImportResult] = useState<ImportResultData | null>(null);

  // 로딩/에러 상태
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 테이블 필터
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // ──── 파일 업로드 핸들러 ────
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // .csv 또는 .txt 파일만 허용
      if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
        setError("CSV 또는 TXT 파일만 업로드할 수 있습니다.");
        return;
      }

      const text = await file.text();
      setCsvText(text);
      setError(null);
      e.target.value = ""; // 같은 파일 재업로드 가능하게
    },
    []
  );

  // ──── 미리보기 요청 ────
  const handlePreview = useCallback(async () => {
    if (!csvText.trim()) {
      setError("CSV 데이터를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/import-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "preview", csvText }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "미리보기 실패");
        return;
      }

      setPreview(data.preview);
      setStep("preview");
    } catch {
      setError("서버 통신 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [csvText]);

  // ──── 실행 요청 ────
  const handleExecute = useCallback(async () => {
    if (!confirm("이관을 실행하시겠습니까? DB에 데이터가 삽입됩니다.")) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/import-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "execute", csvText }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "이관 실행 실패");
        return;
      }

      setImportResult(data.result);
      setStep("result");
    } catch {
      setError("서버 통신 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [csvText]);

  // ──── 초기화 (다시 시작) ────
  const handleReset = useCallback(() => {
    setStep("upload");
    setCsvText("");
    setPreview(null);
    setImportResult(null);
    setError(null);
    setStatusFilter("ALL");
  }, []);

  // 미리보기 필터링된 학생 목록
  const filteredStudents =
    preview?.students.filter(
      (s) => statusFilter === "ALL" || s.status === statusFilter
    ) || [];

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">수강생 데이터 이관</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            구글 스프레드시트 CSV 데이터를 DB로 이관합니다.
          </p>
        </div>
        {step !== "upload" && (
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <span className="material-symbols-outlined text-base align-middle mr-1">
              restart_alt
            </span>
            처음부터 다시
          </button>
        )}
      </div>

      {/* 단계 표시 */}
      <StepIndicator current={step} />

      {/* 에러 표시 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-red-500 mt-0.5">error</span>
          <div>
            <p className="text-sm font-medium text-red-800">오류</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* ===== 1단계: 업로드 ===== */}
      {step === "upload" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            <span className="material-symbols-outlined text-xl align-middle mr-2 text-blue-500">
              upload_file
            </span>
            CSV 데이터 입력
          </h2>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            구글 스프레드시트에서 전체 데이터를 복사하여 아래에 붙여넣거나,
            CSV 파일을 업로드해주세요.
          </p>

          {/* 텍스트 입력 영역 */}
          <textarea
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setError(null);
            }}
            placeholder="여기에 스프레드시트 데이터를 붙여넣으세요... (Ctrl+V)&#10;&#10;헤더 행을 포함해서 전체를 복사해주세요."
            className="w-full h-48 p-4 border rounded-lg text-sm font-mono resize-y focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
          />

          {/* 파일 업로드 */}
          <div className="flex items-center gap-4">
            <label className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-base align-middle mr-1">
                attach_file
              </span>
              CSV 파일 선택
              <input
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>

            {csvText && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {csvText.split("\n").filter((l) => l.trim()).length}행 입력됨
              </span>
            )}
          </div>

          {/* 미리보기 버튼 */}
          <div className="pt-2">
            <button
              onClick={handlePreview}
              disabled={loading || !csvText.trim()}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin material-symbols-outlined text-base">progress_activity</span>
                  파싱 중...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">preview</span>
                  미리보기
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ===== 2단계: 미리보기 ===== */}
      {step === "preview" && preview && (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <SummaryCard label="전체 행" value={preview.summary.totalRows} icon="table_rows" />
            <SummaryCard label="고유 학생" value={preview.summary.uniqueStudents} icon="person" color="blue" />
            <SummaryCard label="재원" value={preview.summary.activeCount} icon="check_circle" color="green" />
            <SummaryCard label="휴원" value={preview.summary.pausedCount} icon="pause_circle" color="yellow" />
            <SummaryCard label="퇴원" value={preview.summary.withdrawnCount} icon="cancel" color="red" />
            <SummaryCard label="1호점" value={preview.summary.branch1Count} icon="location_on" />
            <SummaryCard label="2호점" value={preview.summary.branch2Count} icon="location_on" color="blue" />
          </div>

          {/* 에러 목록 (있는 경우) */}
          {preview.errors.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm font-medium text-yellow-800 mb-2">
                <span className="material-symbols-outlined text-base align-middle mr-1">warning</span>
                파싱 경고 ({preview.errors.length}건)
              </p>
              <ul className="text-sm text-yellow-700 space-y-1">
                {preview.errors.slice(0, 10).map((e, i) => (
                  <li key={i}>
                    행 {e.rowNumber}: {e.reason}
                  </li>
                ))}
                {preview.errors.length > 10 && (
                  <li className="text-yellow-500">... 외 {preview.errors.length - 10}건</li>
                )}
              </ul>
            </div>
          )}

          {/* 필터 탭 */}
          <div className="flex gap-2">
            {[
              { key: "ALL", label: "전체", count: preview.students.length },
              { key: "ACTIVE", label: "재원", count: preview.summary.activeCount },
              { key: "PAUSED", label: "휴원", count: preview.summary.pausedCount },
              { key: "WITHDRAWN", label: "퇴원", count: preview.summary.withdrawnCount },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  statusFilter === tab.key
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* 학생 테이블 */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">#</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">지점</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">이름</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">학부모</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">학교/학년</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">상태</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">결제</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">수업</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredStudents.slice(0, 100).map((s, i) => {
                    const statusInfo = STATUS_LABEL[s.status] || { text: s.status, color: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100" };
                    return (
                      <tr key={i} className="hover:bg-gray-50 dark:bg-gray-900">
                        <td className="px-4 py-3 text-gray-400">{s.rowNumber}</td>
                        <td className="px-4 py-3">{s.branch}</td>
                        <td className="px-4 py-3 font-medium">{s.name}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {s.parentName}
                          <br />
                          <span className="text-xs text-gray-400">{s.parentPhone}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {s.school || "-"}
                          {s.grade && <span className="text-xs text-gray-400 ml-1">{s.grade}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                            {statusInfo.text}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {s.paymentMethod ? METHOD_LABEL[s.paymentMethod] || s.paymentMethod : "-"}
                          {s.amount ? (
                            <span className="text-xs text-gray-400 ml-1">
                              {s.amount.toLocaleString()}원
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          {s.slotKeys.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {s.slotKeys.map((key) => (
                                <span
                                  key={key}
                                  className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded"
                                >
                                  {key}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredStudents.length > 100 && (
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t text-sm text-gray-500 dark:text-gray-400">
                상위 100명만 표시됨 (전체 {filteredStudents.length}명)
              </div>
            )}
          </div>

          {/* 실행 버튼 */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setStep("upload")}
              className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
            >
              뒤로
            </button>
            <button
              onClick={handleExecute}
              disabled={loading || preview.students.length === 0}
              className="px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin material-symbols-outlined text-base">progress_activity</span>
                  이관 실행 중...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">database</span>
                  이관 실행 ({preview.students.length}명)
                </span>
              )}
            </button>
          </div>
        </>
      )}

      {/* ===== 3단계: 결과 ===== */}
      {step === "result" && importResult && (
        <div className="space-y-6">
          {/* 성공 배너 */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <span className="material-symbols-outlined text-5xl text-green-500">check_circle</span>
            <h2 className="text-xl font-bold text-green-800 mt-3">이관 완료</h2>
            <p className="text-sm text-green-600 mt-1">
              데이터가 성공적으로 DB에 삽입되었습니다.
            </p>
          </div>

          {/* 결과 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ResultCard
              label="학부모 (User)"
              created={importResult.created.users}
              skipped={importResult.skipped.users}
            />
            <ResultCard
              label="학생 (Student)"
              created={importResult.created.students}
              skipped={importResult.skipped.students}
            />
            <ResultCard
              label="수강 (Enrollment)"
              created={importResult.created.enrollments}
              skipped={importResult.skipped.enrollments}
            />
            <ResultCard
              label="결제 (Payment)"
              created={importResult.created.payments}
              skipped={importResult.skipped.payments}
            />
          </div>

          {/* 실패 목록 */}
          {importResult.failed.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-medium text-red-800 mb-2">
                <span className="material-symbols-outlined text-base align-middle mr-1">error</span>
                실패 ({importResult.failed.length}건)
              </p>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {importResult.failed.map((f, i) => (
                  <p key={i} className="text-sm text-red-600">
                    행 {f.rowNumber} ({f.name}): {f.reason}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* 다시 시작 */}
          <div className="flex justify-center">
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              <span className="material-symbols-outlined text-base align-middle mr-1">restart_alt</span>
              새 이관 시작
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// 서브 컴포넌트
// ──────────────────────────────────────────────

/** 단계 표시 바 */
function StepIndicator({ current }: { current: "upload" | "preview" | "result" }) {
  const steps = [
    { key: "upload", label: "CSV 입력", icon: "upload_file" },
    { key: "preview", label: "미리보기", icon: "preview" },
    { key: "result", label: "완료", icon: "check_circle" },
  ];

  const currentIdx = steps.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          {i > 0 && (
            <div
              className={`w-8 h-0.5 ${
                i <= currentIdx ? "bg-blue-500" : "bg-gray-200"
              }`}
            />
          )}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
              i === currentIdx
                ? "bg-blue-100 text-blue-700"
                : i < currentIdx
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 dark:bg-gray-800 text-gray-400"
            }`}
          >
            <span className="material-symbols-outlined text-base">{s.icon}</span>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 요약 카드 */
function SummaryCard({
  label,
  value,
  icon,
  color = "gray",
}: {
  label: string;
  value: number;
  icon: string;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    gray: "text-gray-500 dark:text-gray-400",
    blue: "text-blue-500",
    green: "text-green-500",
    yellow: "text-yellow-500",
    red: "text-red-500",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className={`material-symbols-outlined text-lg ${colorMap[color]}`}>
          {icon}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value.toLocaleString()}</p>
    </div>
  );
}

/** 결과 카드 (생성/건너뜀 표시) */
function ResultCard({
  label,
  created,
  skipped,
}: {
  label: string;
  created: number;
  skipped: number;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-4">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-green-600">생성</span>
          <span className="font-bold text-green-700">{created}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">건너뜀 (중복)</span>
          <span className="text-gray-500 dark:text-gray-400">{skipped}</span>
        </div>
      </div>
    </div>
  );
}
