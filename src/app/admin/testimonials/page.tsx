import { getAllTestimonials, getAcademySettings } from "@/lib/queries";
import TestimonialsAdminClient from "./TestimonialsAdminClient";

// 30초 캐시: Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AdminTestimonialsPage() {
    // DB에서 전체 후기 + 학원 설정(naverPlaceUrl) 조회
    const [testimonials, settings] = await Promise.all([
        getAllTestimonials(),
        getAcademySettings(),
    ]);
    return (
        <TestimonialsAdminClient
            testimonials={testimonials}
            naverPlaceUrl={settings?.naverPlaceUrl ?? ""}
        />
    );
}
