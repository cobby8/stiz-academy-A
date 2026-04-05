import type { Metadata } from "next";
import "./globals.css";
import { getAcademySettings } from "@/lib/queries";
import { BODY_FONT_OPTIONS, HEADING_FONT_OPTIONS, getFontCss } from "@/lib/fonts";
import { ThemeProvider } from "@/components/ThemeProvider";

// --- next/font/google: 빌드 시 폰트 파일을 자체 호스팅하여 외부 DNS 조회 제거, CLS 방지 ---
import { Noto_Sans_KR, Nanum_Gothic, IBM_Plex_Sans_KR, Black_Han_Sans, Jua } from "next/font/google";

// 본문용 폰트 (weight 옵션으로 필요한 굵기만 로드)
const notoSansKr = Noto_Sans_KR({
    subsets: ["latin"],
    weight: ["300", "400", "500", "700", "900"],
    display: "swap", // FOUT 방식: 폰트 로드 전 시스템 폰트 표시 → CLS 방지
    variable: "--font-noto-sans-kr",
});

const nanumGothic = Nanum_Gothic({
    subsets: ["latin"],
    weight: ["400", "700", "800"],
    display: "swap",
    variable: "--font-nanum-gothic",
});

const ibmPlexSansKr = IBM_Plex_Sans_KR({
    subsets: ["latin"],
    weight: ["300", "400", "500", "600", "700"],
    display: "swap",
    variable: "--font-ibm-plex-sans-kr",
});

// 제목용 폰트 (단일 weight)
const blackHanSans = Black_Han_Sans({
    subsets: ["latin"],
    weight: "400",
    display: "swap",
    variable: "--font-black-han-sans",
});

const jua = Jua({
    subsets: ["latin"],
    weight: "400",
    display: "swap",
    variable: "--font-jua",
});

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
        // next/font CSS variable 클래스를 html에 적용 → 폰트가 self-hosted로 로드됨
        <html
            lang="ko"
            className={`${notoSansKr.variable} ${nanumGothic.variable} ${ibmPlexSansKr.variable} ${blackHanSans.variable} ${jua.variable}`}
            suppressHydrationWarning
        >
            <head>
                {/* PWA 테마 색상 - 브라우저 상단 바 색상을 브랜드 오렌지로 */}
                <meta name="theme-color" content="#f97316" />
                {/* iOS에서 홈 화면 아이콘으로 쓸 이미지 */}
                <link rel="apple-touch-icon" href="/icon-192.png" />
                {/* Pretendard는 Google Fonts에 없으므로 CDN 유지 */}
                <link
                    rel="stylesheet"
                    href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
                />
                {/* Material Symbols Outlined: 가이드 투어 등에서 사용하는 아이콘 폰트 */}
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
                />
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
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
