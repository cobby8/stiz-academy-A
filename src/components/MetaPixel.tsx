"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "537084849778028";
const TRACK_RETRY_LIMIT = 3;
const TRACK_RETRY_DELAY_MS = 600;

type MetaEventParams = Record<string, string | number | boolean | undefined>;

declare global {
    interface Window {
        fbq?: (...args: unknown[]) => void;
    }
}

function getTestEventCode() {
    if (typeof window === "undefined") return undefined;
    return new URLSearchParams(window.location.search).get("test_event_code")?.trim() || undefined;
}

function withTestEventCode(params?: MetaEventParams) {
    const testEventCode = getTestEventCode();
    return testEventCode ? { ...(params ?? {}), test_event_code: testEventCode } : params ?? {};
}

export function trackMetaEvent(eventName: string, params?: MetaEventParams, retryCount = 0) {
    if (typeof window === "undefined" || !META_PIXEL_ID) return;

    if (!window.fbq) {
        if (retryCount < TRACK_RETRY_LIMIT) {
            window.setTimeout(
                () => trackMetaEvent(eventName, params, retryCount + 1),
                TRACK_RETRY_DELAY_MS * (retryCount + 1),
            );
        }
        return;
    }

    window.fbq("track", eventName, withTestEventCode(params));
}

export default function MetaPixel() {
    const pathname = usePathname();

    useEffect(() => {
        trackMetaEvent("PageView");
    }, [pathname]);

    if (!META_PIXEL_ID) return null;

    return (
        <>
            <Script id="meta-pixel" strategy="afterInteractive">
                {`
                    !function(f,b,e,v,n,t,s)
                    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                    n.queue=[];t=b.createElement(e);t.async=!0;
                    t.src=v;s=b.getElementsByTagName(e)[0];
                    s.parentNode.insertBefore(t,s)}(window, document,'script',
                    'https://connect.facebook.net/en_US/fbevents.js');
                    fbq('init', '${META_PIXEL_ID}');
                `}
            </Script>
            <noscript>
                <img
                    height="1"
                    width="1"
                    style={{ display: "none" }}
                    src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
                    alt=""
                />
            </noscript>
        </>
    );
}
