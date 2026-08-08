import type { Metadata } from "next";
import type { ReactNode } from "react";

// 기사님 전용 레이아웃 — 공용 manifest 대신 기사님 앱 manifest를 주입한다.
export const metadata: Metadata = {
  manifest: "/driver-manifest.json",
  title: "스티즈 기사님",
  description: "스티즈농구교실 셔틀 기사님 전용 운행 앱",
  themeColor: "#FF6B00",
};

export default function DriverLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
