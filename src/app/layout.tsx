import type { Metadata } from "next";
import "./globals.css";
import { getAcademySettings } from "@/lib/queries";
import { BODY_FONT_OPTIONS, HEADING_FONT_OPTIONS, getFontCss } from "@/lib/fonts";
import { ThemeProvider } from "@/components/ThemeProvider";
import MetaPixel from "@/components/MetaPixel";
import DeferredFontStyles from "@/components/DeferredFontStyles";
import PwaUpdater from "@/components/PwaUpdater";

export const metadata: Metadata = {
    title: "스티즈농구교실 다산점 | 스마트 학원 관리",
    description: "우리아이 농구교실 스티즈농구교실 다산점의 스마트 출결/결제 관리 시스템입니다.",
    // PWA manifest 연결 - 홈 화면 추가 시 앱처럼 동작하게 해줌
    manifest: "/manifest.json",
    // iOS Safari용 PWA 설정 (Apple은 manifest를 완전히 지원하지 않아 별도 메타 태그 필요)
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "스티즈농구",
    },
    // Open Graph: 카카오톡/페이스북 등에서 링크 공유 시 미리보기 카드에 표시되는 정보
    openGraph: {
        title: "STIZ 농구교실 다산점",
        description: "다산신도시 No.1 농구 전문 학원",
        url: "https://stiz-dasan.kr",
        siteName: "STIZ 농구교실 다산점",
        locale: "ko_KR",
        type: "website",
    },
    // Twitter(X) 카드: 트위터에서 링크 공유 시 큰 이미지 카드로 표시
    twitter: {
        card: "summary_large_image",
        title: "STIZ 농구교실 다산점",
        description: "다산신도시 No.1 농구 전문 학원",
    },
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // 폰트 설정을 DB에서 읽어 CSS 변수로 주입 (실패 시 시스템 폰트로 fallback)
    let bodyFontCss = getFontCss("system", BODY_FONT_OPTIONS);
    let headingFontCss = getFontCss("same-as-body", HEADING_FONT_OPTIONS);
    try {
        const settings = await getAcademySettings() as any;
        bodyFontCss = getFontCss(settings?.siteBodyFont, BODY_FONT_OPTIONS);
        const rawHeading = getFontCss(settings?.siteHeadingFont, HEADING_FONT_OPTIONS);
        headingFontCss = rawHeading === "inherit" ? bodyFontCss : rawHeading;
    } catch {
        // fallback to system fonts
    }

    return (
        <html
            lang="ko"
            suppressHydrationWarning
        >
            <head>
                {/* PWA 테마 색상 - 브라우저 상단 바 색상을 브랜드 오렌지로 */}
                <meta name="theme-color" content="#f97316" />
                {/* iOS에서 홈 화면 아이콘으로 쓸 이미지 */}
                <link rel="apple-touch-icon" href="/icon-192.png" />
            </head>
            <body
                className="antialiased selection:bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 selection:text-white"
                style={
                    {
                        "--font-body": bodyFontCss,
                        "--font-heading": headingFontCss,
                    } as React.CSSProperties
                }
            >
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <DeferredFontStyles />
                    <MetaPixel />
                    <PwaUpdater />
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
