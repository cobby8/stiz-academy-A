"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const GalleryLightboxOverlay = dynamic(() => import("./GalleryLightboxOverlay"), {
    ssr: false,
    loading: () => null,
});

export type GalleryLightboxItem = {
    url: string;
    type: "image" | "video";
    title: string | null;
    caption: string | null;
    postId: string;
    mediaIdx: number;
    createdAt: string;
    displayDate: string;
};

export default function GalleryLightboxController({ items }: { items: GalleryLightboxItem[] }) {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    useEffect(() => {
        function handleClick(event: MouseEvent) {
            const target =
                event.target instanceof Element
                    ? event.target.closest<HTMLElement>("[data-gallery-index]")
                    : null;
            if (!target || !target.closest("[data-gallery-root]")) return;

            const index = Number(target.dataset.galleryIndex);
            if (!Number.isInteger(index) || index < 0 || index >= items.length) return;
            setActiveIndex(index);
        }

        document.addEventListener("click", handleClick);
        return () => document.removeEventListener("click", handleClick);
    }, [items.length]);

    if (activeIndex === null) return null;

    return (
        <GalleryLightboxOverlay
            items={items}
            activeIndex={activeIndex}
            onClose={() => setActiveIndex(null)}
            onNavigate={setActiveIndex}
        />
    );
}
