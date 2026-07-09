"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
    ssr: false,
    loading: () => (
        <div className="border border-gray-300 rounded-md p-4 min-h-[150px] bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-sm text-gray-400">
            에디터 로딩중...
        </div>
    ),
});

export default function LazyRichTextEditor({
    value,
    onChange,
    placeholder,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [shouldLoad, setShouldLoad] = useState(false);

    useEffect(() => {
        if (shouldLoad) return;
        const node = rootRef.current;
        if (!node) return;

        if (typeof IntersectionObserver === "undefined") {
            const timeout = window.setTimeout(() => setShouldLoad(true), 800);
            return () => window.clearTimeout(timeout);
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setShouldLoad(true);
                    observer.disconnect();
                }
            },
            { rootMargin: "320px 0px" },
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [shouldLoad]);

    return (
        <div ref={rootRef} onMouseEnter={() => setShouldLoad(true)} onFocus={() => setShouldLoad(true)}>
            {shouldLoad ? (
                <RichTextEditor value={value} onChange={onChange} placeholder={placeholder} />
            ) : (
                <button
                    type="button"
                    onClick={() => setShouldLoad(true)}
                    className="w-full border border-gray-300 rounded-md p-4 min-h-[150px] bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-300 hover:border-brand-orange-500 dark:hover:border-brand-neon-lime transition"
                >
                    <span className="font-bold text-gray-700 dark:text-gray-100">편집기 준비</span>
                    <span className="text-xs text-gray-400">클릭하거나 이 영역이 보이면 편집기를 불러옵니다.</span>
                </button>
            )}
        </div>
    );
}
