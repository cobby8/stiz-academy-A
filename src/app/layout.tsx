import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "스티즈농구교실 다산점 | 스마트 학원 관리",
  description: "우리아이 농구교실 스티즈농구교실 다산점의 스마트 출결/결제 관리 시스템입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased selection:bg-brand-orange-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
