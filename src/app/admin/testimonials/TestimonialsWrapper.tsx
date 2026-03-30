"use client";

import dynamic from "next/dynamic";

// SSR 비활성화 — Next.js 16 Turbopack에서 서버 액션 import가 SSR 시 실행되는 버그 우회
// "use client" 컴포넌트에서만 ssr: false 사용 가능
const TestimonialsAdminClient = dynamic(() => import("./TestimonialsAdminClient"), { ssr: false });

export default function TestimonialsWrapper(props: {
    testimonials: {
        id: string;
        name: string;
        info: string;
        text: string;
        rating: number;
        order: number;
        isPublic: boolean;
        createdAt: Date | string;
    }[];
    naverPlaceUrl: string;
}) {
    return <TestimonialsAdminClient {...props} />;
}
