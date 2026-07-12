"use client";

import { useEffect } from "react";

const SERVICE_WORKER_URL = "/sw.js";

export default function PwaUpdater() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const hadController = Boolean(navigator.serviceWorker.controller);
    let didReload = false;

    const reloadForFreshApp = () => {
      if (!hadController || didReload) return;
      didReload = true;
      window.location.reload();
    };

    const requestSkipWaiting = (worker?: ServiceWorker | null) => {
      worker?.postMessage({ type: "SKIP_WAITING" });
    };

    const handleControllerChange = () => {
      reloadForFreshApp();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    async function registerAndUpdate() {
      try {
        const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
          updateViaCache: "none",
        });

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;

          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              requestSkipWaiting(worker);
            }
          });
        });

        if (registration.waiting && navigator.serviceWorker.controller) {
          requestSkipWaiting(registration.waiting);
        }

        await registration.update();
      } catch (error) {
        console.warn("[PWA] Service worker update check failed", error);
      }
    }

    const updateWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      navigator.serviceWorker
        .getRegistration(SERVICE_WORKER_URL)
        .then((registration) => registration?.update())
        .catch(() => {});
    };

    registerAndUpdate();
    document.addEventListener("visibilitychange", updateWhenVisible);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      document.removeEventListener("visibilitychange", updateWhenVisible);
    };
  }, []);

  return null;
}
