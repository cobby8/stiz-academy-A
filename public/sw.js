// STIZ PWA service worker
// 사용자 정보가 포함될 수 있는 화면/데이터는 저장하지 않고 공개 정적 자산만 캐시한다.
const CACHE_NAME = "stiz-public-static-v20260715-2";

const PRECACHE_URLS = [
    "/manifest.json",
    "/manifest-staff.json",
    "/icon-192.png",
    "/icon-512.png",
];

// 이 경로는 응답뿐 아니라 과거 캐시 fallback도 금지한다.
const PRIVATE_PATH_PREFIXES = [
    "/staff",
    "/mypage",
    "/admin",
    "/api",
    "/invite",
    "/login",
    "/auth",
];

const PRIVATE_QUERY_KEYS = ["_rsc", "__flight__"];

function isPrivateRequest(request, url) {
    if (url.origin !== self.location.origin) return true;

    if (PRIVATE_PATH_PREFIXES.some(
        (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
    )) {
        return true;
    }

    if (PRIVATE_QUERY_KEYS.some((key) => url.searchParams.has(key))) return true;

    // Next.js Server Component/Flight 응답은 URL이 공개 경로처럼 보여도
    // 로그인 상태에 따른 데이터가 포함될 수 있다.
    const accept = request.headers.get("accept") || "";
    if (accept.includes("text/x-component")) return true;
    if (request.headers.has("rsc") || request.headers.has("next-router-state-tree")) {
        return true;
    }

    return false;
}

function isPublicStaticAsset(request, url) {
    if (url.origin !== self.location.origin) return false;

    if (url.pathname.startsWith("/_next/static/")) return true;

    return PRECACHE_URLS.includes(url.pathname) && request.destination !== "document";
}

function safeNotificationPath(candidate) {
    if (typeof candidate !== "string" || /[\\\u0000-\u001f\u007f]/.test(candidate)) return "/mypage";
    try {
        const decoded = decodeURIComponent(candidate);
        if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\")) return "/mypage";
        const parsed = new URL(candidate, self.location.origin);
        if (parsed.origin !== self.location.origin) return "/mypage";
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return "/mypage";
    }
}

function offlineResponse(request) {
    if (request.mode !== "navigate" && request.destination !== "document") {
        return new Response("오프라인 상태입니다.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
    }

    // 이전 사용자 화면을 보여주는 대신 개인정보가 없는 고정 안내만 반환한다.
    return new Response(
        `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>오프라인</title><style>body{font-family:system-ui,sans-serif;margin:0;padding:32px;background:#f8fafc;color:#172033}main{max-width:480px;margin:15vh auto;background:#fff;padding:28px;border-radius:16px;box-shadow:0 8px 30px #00000010}h1{font-size:22px}p{line-height:1.6}</style></head><body><main><h1>인터넷 연결을 확인해 주세요</h1><p>학생과 수업 정보를 안전하게 보호하기 위해 오프라인에서는 이전 화면을 표시하지 않습니다. 연결 후 새로고침해 주세요.</p></main></body></html>`,
        {
            status: 503,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store",
            },
        }
    );
}

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            // 과거 서비스워커가 만든 위험 캐시를 포함해 현재 공개 자산 캐시 외에는 모두 삭제한다.
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("message", (event) => {
    if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") return;

    const url = new URL(request.url);

    // 인증/개인정보/RSC 요청은 HTTP 캐시까지 우회해 네트워크로만 가져온다.
    // 실패하더라도 과거 캐시로 돌아가지 않고 개인정보가 없는 안내만 반환한다.
    if (isPrivateRequest(request, url)) {
        event.respondWith(
            fetch(request, { cache: "no-store" }).catch(() => offlineResponse(request))
        );
        return;
    }

    if (isPublicStaticAsset(request, url)) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;

                return fetch(request).then((response) => {
                    if (response.ok && response.type === "basic") {
                        const clone = response.clone();
                        event.waitUntil(
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
                        );
                    }
                    return response;
                });
            })
        );
        return;
    }

    // 공개 페이지도 HTML 자체는 저장하지 않는다. 네트워크 실패 시 안전한 안내만 표시한다.
    if (request.mode === "navigate" || request.destination === "document") {
        event.respondWith(fetch(request).catch(() => offlineResponse(request)));
    }
});

self.addEventListener("push", (event) => {
    let data = {
        title: "STIZ 농구교실",
        body: "새 알림이 있습니다.",
        url: "/mypage",
    };

    try {
        if (event.data) data = event.data.json();
    } catch {
        // 잘못된 payload는 개인정보가 없는 기본 문구로 표시한다.
    }

    event.waitUntil(
        self.registration.showNotification(data.title || "STIZ 농구교실", {
            body: data.body,
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            data: { url: safeNotificationPath(data.url) },
            vibrate: [200, 100, 200],
            tag: data.tag || "stiz-notification",
            renotify: true,
        })
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = safeNotificationPath(event.notification.data?.url);

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.startsWith(self.location.origin) && "focus" in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            return clients.openWindow(url);
        })
    );
});
