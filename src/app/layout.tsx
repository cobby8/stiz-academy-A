import type { Metadata } from "next";
import "./globals.css";
import { getAcademySettings } from "@/lib/queries";
import { BODY_FONT_OPTIONS, HEADING_FONT_OPTIONS, getFontCss } from "@/lib/fonts";
import { ThemeProvider } from "@/components/ThemeProvider";
import MetaPixel from "@/components/MetaPixel";
import DeferredFontStyles from "@/components/DeferredFontStyles";
import PwaUpdater from "@/components/PwaUpdater";
import ThemeColorUpdater from "@/components/ThemeColorUpdater";
import { buildPublicMetadata } from "@/lib/publicMetadata";

export const metadata: Metadata = {
    ...buildPublicMetadata({
        title: "STIZ 농구교실 다산점 | 다산신도시 No.1 농구 전문 학원",
        description: "유아·초등·중등 수준별 맞춤 농구 수업, 전문 코치진, 셔틀 안내와 체험수업 신청까지 한 번에 확인하세요.",
        path: "/",
    }),
    // PWA manifest 연결 - 홈 화면 추가 시 앱처럼 동작하게 해줌
    manifest: "/manifest.json",
    // iOS Safari용 PWA 설정 (Apple은 manifest를 완전히 지원하지 않아 별도 메타 태그 필요)
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "스티즈농구",
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
                {/* PWA 테마 색상은 ThemeColorUpdater가 현재 테마에 맞게 갱신합니다. */}
                <meta name="theme-color" content="#ccff00" />
                {/* 파일명을 버전 처리해 브라우저에 남은 이전 탭 아이콘 캐시를 교체합니다. */}
                <link rel="icon" href="/favicon-v2.ico" sizes="any" />
                <link rel="shortcut icon" href="/favicon-v2.ico" />
                {/* iOS에서 홈 화면 아이콘으로 쓸 이미지 */}
                <link rel="apple-touch-icon" href="/icon-v2-192.png" />
            </head>
            <body
                className="antialiased selection:bg-brand-orange-500 selection:text-white dark:selection:bg-brand-neon-lime dark:selection:text-brand-navy-900"
                style={
                    {
                        "--font-body": bodyFontCss,
                        "--font-heading": headingFontCss,
                    } as React.CSSProperties
                }
            >
                <ThemeProvider
                    attribute="class"
                    defaultTheme="dark"
                    enableSystem
                    disableTransitionOnChange
                >
                    <DeferredFontStyles />
                    <MetaPixel />
                    <ThemeColorUpdater />
                    <PwaUpdater />
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
