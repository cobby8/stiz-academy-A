"use client";

import { useState, useTransition, type ReactNode } from "react";

type Direction = "PICKUP" | "DROPOFF";
type RideStatus = "PENDING" | "BOARDED" | "DROPPED_OFF" | "NO_SHOW";

const STATUS_LABEL: Record<RideStatus, string> = {
  PENDING: "대기",
  BOARDED: "탑승",
  DROPPED_OFF: "하차",
  NO_SHOW: "미탑승",
};

export default function ShuttleRideStatusButtons({
  routeId,
  passengerId,
  direction,
  status,
  onStatusChange,
}: {
  routeId: string;
  passengerId: string;
  direction: Direction;
  status: RideStatus;
  onStatusChange: (status: RideStatus) => void;
}) {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const primaryStatus: RideStatus = direction === "PICKUP" ? "BOARDED" : "DROPPED_OFF";

  function update(nextStatus: RideStatus) {
    const previous = status;
    onStatusChange(nextStatus);
    setMessage("저장 중...");
    startTransition(async () => {
      try {
        const response = await fetch("/api/staff/shuttle", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ routeId, passengerId, status: nextStatus }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "상태를 저장하지 못했습니다.");
        setMessage(`${STATUS_LABEL[nextStatus]} 저장 완료`);
      } catch (error) {
        onStatusChange(previous);
        setMessage(error instanceof Error ? error.message : "상태를 저장하지 못했습니다.");
      }
    });
  }

  return (
    <div className="mt-2 space-y-1">
      <div className="grid grid-cols-3 gap-1.5">
        <StatusButton active={status === primaryStatus} disabled={isPending} onClick={() => update(primaryStatus)}>
          {STATUS_LABEL[primaryStatus]}
        </StatusButton>
        <StatusButton active={status === "NO_SHOW"} disabled={isPending} tone="danger" onClick={() => update("NO_SHOW")}>
          미탑승
        </StatusButton>
        <StatusButton active={status === "PENDING"} disabled={isPending} tone="dark" onClick={() => update("PENDING")}>
          대기
        </StatusButton>
      </div>
      <p className={`text-[11px] font-bold ${message.includes("못했습니다") ? "text-red-600 dark:text-red-300" : "text-gray-400"}`} role={message.includes("못했습니다") ? "alert" : "status"}>
        {message || `현재 ${STATUS_LABEL[status]}`}
      </p>
    </div>
  );
}

function StatusButton({
  active,
  disabled,
  tone = "success",
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  tone?: "success" | "danger" | "dark";
  onClick: () => void;
  children: ReactNode;
}) {
  const activeClass =
    tone === "danger"
      ? "bg-red-500 text-white"
      : tone === "dark"
        ? "bg-gray-900 text-white dark:bg-white dark:text-gray-950"
        : "bg-emerald-500 text-white";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-9 rounded-xl text-xs font-black disabled:opacity-60 ${active ? activeClass : "bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-200"}`}
    >
      {children}
    </button>
  );
}
