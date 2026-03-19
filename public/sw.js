// Service Worker - PWA 오프라인 캐싱 + 푸시 알림
// public/ 폴더에 있어야 브라우저가 접근 가능

// 캐시 버전 - 업데이트 시 이 이름을 바꾸면 이전 캐시가 자동 삭제됨
const CACHE_NAME = "stiz-v1";

// 앱 설치 시 미리 캐시할 핵심 파일 목록 (오프라인에서도 보이게)
const PRE_CACHE = [
    "/",
    "/manifest.json",
    "/icon-192.png",
    "/icon-512.png",
];

// install: 서비스 워커 최초 설치 시 핵심 파일을 캐시에 저장
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRE_CACHE))
    );
    // 대기 중인 이전 서비스 워커를 즉시 교체
    self.skipWaiting();
});

// activate: 새 버전 활성화 시 이전 캐시 정리
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    // 현재 열린 모든 탭에 즉시 적용
    self.clients.claim();
});

// fetch: 네트워크 우선, 실패하면 캐시에서 제공 (Network-first 전략)
self.addEventListener("fetch", (event) => {
    const { request } = event;

    // POST 등 GET이 아닌 요청은 캐시하지 않음
    if (request.method !== "GET") return;

    // API/인증 요청은 항상 네트워크로 (캐시하면 안 되는 동적 데이터)
    if (request.url.includes("/api/") || request.url.includes("/admin/")) return;

    event.respondWith(
        fetch(request)
            .then((response) => {
                // 정상 응답이면 캐시에 복사본 저장
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                return response;
            })
            .catch(() => {
                // 네트워크 실패 시 캐시에서 꺼내서 보여줌
                return caches.match(request);
            })
    );
});

// === 푸시 알림 관련 코드 ===

self.addEventListener("push", (event) => {
    // 서버에서 보낸 데이터 파싱
    let data = { title: "STIZ 농구교실", body: "새 알림이 있습니다.", url: "/mypage" };
    try {
        if (event.data) {
            data = event.data.json();
        }
    } catch {
        // JSON 파싱 실패 시 기본값 사용
    }

    // 알림 표시 (앱 아이콘, 뱃지 등 설정)
    const options = {
        body: data.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: data.url || "/mypage" },
        vibrate: [200, 100, 200],
        tag: data.tag || "stiz-notification",
        renotify: true,
    };

    event.waitUntil(
        self.registration.showNotification(data.title || "STIZ 농구교실", options)
    );
});

// 알림 클릭 시 해당 페이지로 이동
self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const url = event.notification.data?.url || "/mypage";

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
            // 이미 열린 탭이 있으면 그 탭으로 포커스
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin) && "focus" in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            // 없으면 새 탭 열기
            return clients.openWindow(url);
        })
    );
});
