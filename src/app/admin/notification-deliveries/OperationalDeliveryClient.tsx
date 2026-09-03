"use client";

import { useCallback, useEffect, useState } from "react";

type Delivery = {
  id: string;
  eventType: string;
  trigger: string | null;
  channel: string;
  status: string;
  attemptCount: number;
  errorMessage: string | null;
  studentName: string | null;
  recipientName: string | null;
  recipientRole: string | null;
  updatedAt: string;
};

const STATUS_OPTIONS = [
  ["all", "전체"], ["attention", "확인 필요"], ["processing", "처리 중"], ["success", "성공"],
] as const;
const CHANNEL_OPTIONS = [["all", "전체 채널"], ["in_app", "사이트 알림"], ["push", "휴대폰 푸시"]] as const;

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "원장", VICE_ADMIN: "부원장", INSTRUCTOR: "담당 코치", DRIVER: "담당 기사",
};
const EVENT_LABEL: Record<string, string> = {
  REGULAR_ABSENCE_REPORTED: "정규수업 결석 접수",
  REGULAR_ABSENCE_CANCELED: "정규수업 결석 취소",
  SHUTTLE_DAY_EXCEPTION_SUBMITTED: "당일 셔틀 변경",
  SHUTTLE_DAY_EXCEPTION_CANCELED: "당일 셔틀 변경 취소",
};

function statusView(status: string) {
  if (status === "SENT") return { label: "전달 완료", className: "bg-green-100 text-green-700" };
  if (status === "PENDING") return { label: "자동 재시도 중", className: "bg-blue-100 text-blue-700" };
  if (status === "PARTIAL") return { label: "일부 실패", className: "bg-amber-100 text-amber-800" };
  if (status === "SKIPPED") return { label: "푸시 미등록", className: "bg-amber-100 text-amber-800" };
  return { label: "전달 실패", className: "bg-red-100 text-red-700" };
}

export default function OperationalDeliveryClient() {
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const [rows, setRows] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/operational-deliveries?status=${status}&channel=${channel}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "전달 장부를 불러오지 못했습니다.");
      setRows(data.deliveries ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "전달 장부를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [channel, status]);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="space-y-5">
      <div>
        <p className="text-sm font-bold text-blue-600">운영 알림</p>
        <h1 className="mt-1 text-2xl font-black text-gray-950 dark:text-white">담당자 전달 장부</h1>
        <p className="mt-2 text-sm text-gray-500">결석·셔틀 요청이 원장, 담당 코치와 담당 기사에게 전달된 상태를 확인합니다.</p>
      </div>

      <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap gap-2" aria-label="전달 상태 필터">
          {STATUS_OPTIONS.map(([value, label]) => <button key={value} type="button" onClick={() => setStatus(value)} className={`min-h-10 rounded-xl px-4 text-sm font-black ${status === value ? "bg-brand-navy-900 text-white" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-200"}`}>{label}</button>)}
        </div>
        <div className="flex flex-wrap gap-2" aria-label="채널 필터">
          {CHANNEL_OPTIONS.map(([value, label]) => <button key={value} type="button" onClick={() => setChannel(value)} className={`min-h-10 rounded-xl px-4 text-sm font-bold ${channel === value ? "bg-blue-600 text-white" : "border border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-200"}`}>{label}</button>)}
        </div>
      </section>

      {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}<button type="button" onClick={() => void load()} className="ml-3 underline">다시 불러오기</button></div>}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {loading ? <p className="p-10 text-center text-sm text-gray-500">전달 상태를 불러오는 중입니다.</p> : rows.length === 0 ? <p className="p-10 text-center text-sm text-gray-500">선택한 조건의 전달 기록이 없습니다.</p> : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((row) => {
              const view = statusView(row.status);
              return <article key={row.id} className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${view.className}`}>{view.label}</span>
                  <strong className="text-sm text-gray-950 dark:text-white">{EVENT_LABEL[row.eventType] ?? row.eventType}</strong>
                  <time className="ml-auto text-xs text-gray-400">{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" }).format(new Date(row.updatedAt))}</time>
                </div>
                <div className="mt-3 grid gap-1 text-sm text-gray-700 dark:text-gray-200 sm:grid-cols-2">
                  <p>학생: <strong>{row.studentName ?? "학생 정보 없음"}</strong></p>
                  <p>수신: <strong>{ROLE_LABEL[row.recipientRole ?? ""] ?? "담당자"} {row.recipientName ?? "미확인"}</strong></p>
                  <p>채널: <strong>{row.channel === "IN_APP" ? "사이트 알림" : "휴대폰 푸시"}</strong></p>
                  <p>시도: <strong>{row.attemptCount}회</strong></p>
                </div>
                {row.errorMessage && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{row.errorMessage}</p>}
              </article>;
            })}
          </div>
        )}
      </section>
      <p className="text-xs leading-5 text-gray-500">푸시는 자동으로 최대 5회 재시도됩니다. 푸시 미등록이어도 사이트 내부 알림이 전달 완료인지 함께 확인해 주세요.</p>
    </main>
  );
}
