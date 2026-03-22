import { MetadataRoute } from "next";

// robots.txt 자동 생성 - 검색엔진 크롤러에게 "이 페이지는 수집해도 되고, 이건 안 됨"을 알려주는 파일
// /admin, /api, /login, /setup은 검색에 노출되면 안 되므로 차단
export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: ["/admin/", "/api/", "/login", "/setup"],
        },
        // 검색엔진이 사이트맵을 자동으로 찾을 수 있도록 경로 명시
        sitemap: "https://stiz-dasan.kr/sitemap.xml",
    };
}
