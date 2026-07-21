"use client";

import { useState, useTransition } from "react";

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
  initialStatus,
}: {
  routeId: string;
  passengerId: string;
  direction: Direction;
  initialStatus: RideStatus;
}) {
  const [status, setStatus] = useState<RideStatus>(initialStatus || "PENDING");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const primaryStatus: RideStatus = direction === "PICKUP" ? "BOARDED" : "DROPPED_OFF";

  function update(nextStatus: RideStatus) {
    const previous = status;
    setStatus(nextStatus);
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/staff/shuttle", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ routeId, passengerId, status: nextStatus }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "상태를 저장하지 못했습니다.");
      } catch (error) {
        setStatus(previous);
        setMessage(error instanceof Error ? error.message : "상태를 저장하지 못했습니다.");
      }
    });
  }

  return (
    <div className="mt-2 space-y-1">
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => update(primaryStatus)}
          disabled={isPending}
          className={`min-h-9 rounded-xl text-xs font-black ${status === primaryStatus ? "bg-emerald-500 text-white" : "bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-200"}`}
        >
          {STATUS_LABEL[primaryStatus]}
        </button>
        <button
          type="button"
          onClick={() => update("NO_SHOW")}
          disabled={isPending}
          className={`min-h-9 rounded-xl text-xs font-black ${status === "NO_SHOW" ? "bg-red-500 text-white" : "bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-200"}`}
        >
          미탑승
        </button>
        <button
          type="button"
          onClick={() => update("PENDING")}
          disabled={isPending}
          className={`min-h-9 rounded-xl text-xs font-black ${status === "PENDING" ? "bg-gray-900 text-white dark:bg-white dark:text-gray-950" : "bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-200"}`}
        >
          대기
        </button>
      </div>
      <p className={`text-[11px] font-bold ${message ? "text-red-600 dark:text-red-300" : "text-gray-400"}`} role={message ? "alert" : "status"}>
        {message || `현재 ${STATUS_LABEL[status]}`}
      </p>
    </div>
  );
}
