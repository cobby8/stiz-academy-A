import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { requireVerifiedParent } from "@/lib/auth-guard";
import AppBackButton from "@/components/AppBackButton";
import MyPageBottomNav from "./MyPageBottomNav";

// 학부모 앱의 시작 주소가 /mypage 다. 여기서 공용 manifest(id "/")를 내려주면
// 브라우저가 "이 앱은 공식 앱이었나?" 하고 신원을 헷갈린다. 교사용(/staff)과 같은 구조로
// 자기 manifest 를 명시한다.
export const metadata: Metadata = {
  title: "STIZ 학부모",
  description: "자녀의 출결과 셔틀 시각, 결석 신고와 청구를 확인하는 STIZ 학부모용 화면",
  manifest: "/manifest-parent.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "STIZ 학부모",
  },
};

export default async function MyPageLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    await requireVerifiedParent().catch(() => redirect("/auth/continue?redirect=/mypage"));

    return (
        // surface-warm 배경 적용 — 공개 페이지와 동일한 따뜻한 톤
        <div className="min-h-screen bg-surface-warm flex flex-col pb-20 md:pb-0">
            {/* 모바일 상단 헤더 — 기존 구조 유지, 그림자/보더 디자인 토큰 통일 */}
            <header className="bg-white dark:bg-gray-800 sticky top-0 z-50 shadow-sm border-b border-gray-100 dark:border-gray-800 grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 px-4 py-3 md:hidden">
                <AppBackButton fallbackHref="/" size="sm" />
                <Link href="/" className="flex items-center gap-2">
                    <Image src="/stiz-logo.png" alt="STIZ" width={100} height={25} className="h-7 w-auto object-contain" />
                </Link>
                <span className="text-center font-bold text-brand-navy-900 text-sm">마이페이지</span>
                <form action={logout}>
                    <button
                        type="submit"
                        className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        로그아웃
                    </button>
                </form>
            </header>

            {/* 데스크탑 헤더 — 기존 구조 유지, 호버 트랜지션 통일 */}
            <header className="bg-white dark:bg-gray-800 sticky top-0 z-50 shadow-sm border-b border-gray-100 dark:border-gray-800 hidden md:flex items-center justify-between px-8 py-4">
                <div className="flex min-w-0 items-center gap-3">
                    <AppBackButton fallbackHref="/" />
                    <Link href="/" className="flex min-w-0 items-center gap-2">
                        <Image src="/stiz-logo.png" alt="STIZ" width={140} height={35} className="h-9 w-auto object-contain" />
                        <span className="font-extrabold text-xl text-brand-navy-900">
                            스티즈농구교실 <span className="text-brand-orange-500 dark:text-brand-neon-lime">다산점</span>
                        </span>
                    </Link>
                </div>
                <nav className="flex items-center gap-8 font-bold text-gray-600 dark:text-gray-300">
                    <Link href="/mypage" className="text-brand-orange-500 dark:text-brand-neon-lime transition-colors">마이페이지</Link>
                    <Link href="/" className="hover:text-brand-orange-500 dark:text-brand-neon-lime transition-colors">홈으로</Link>
                    <form action={logout}>
                        <button
                            type="submit"
                            className="font-bold text-gray-600 transition-colors hover:text-brand-orange-500 dark:text-gray-300 dark:hover:text-brand-neon-lime"
                        >
                            로그아웃
                        </button>
                    </form>
                </nav>
            </header>

            {/* 메인 콘텐츠 영역 */}
            <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8">
                {children}
            </main>

            {/* 모바일 하단 네비게이션 — 자녀 핵심 기능(리포트·스킬·방학특강) 중심으로 재구성.
                활성 경로 하이라이트를 위해 클라이언트 컴포넌트(MyPageBottomNav)로 분리. */}
            <MyPageBottomNav />
        </div>
    );
}
