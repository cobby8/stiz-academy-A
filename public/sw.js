// Service Worker - 푸시 알림 수신 및 표시
// public/ 폴더에 있어야 브라우저가 접근 가능

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
