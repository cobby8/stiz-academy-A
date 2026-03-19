import type { Metadata } from "next";
import "./globals.css";
import { getAcademySettings } from "@/lib/queries";
import { BODY_FONT_OPTIONS, HEADING_FONT_OPTIONS, getFontCss } from "@/lib/fonts";

export const metadata: Metadata = {
    title: "스티즈농구교실 다산점 | 스마트 학원 관리",
    description: "우리아이 농구교실 스티즈농구교실 다산점의 스마트 출결/결제 관리 시스템입니다.",
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
        <html lang="ko">
            <head>
                {/* Pretendard (CDN) */}
                <link
                    rel="stylesheet"
                    href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
                />
                {/* Google Fonts: Noto Sans KR, Nanum Gothic, IBM Plex Sans KR, Black Han Sans, Jua */}
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&family=Nanum+Gothic:wght@400;700;800&family=IBM+Plex+Sans+KR:wght@300;400;500;600;700&family=Black+Han+Sans&family=Jua&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body
                className="antialiased selection:bg-brand-orange-500 selection:text-white"
                style={
                    {
                        "--font-body": bodyFontCss,
                        "--font-heading": headingFontCss,
                    } as React.CSSProperties
                }
            >
                {children}
            </body>
        </html>
    );
}
