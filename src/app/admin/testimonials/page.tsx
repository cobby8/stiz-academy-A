import TestimonialsWrapper from "./TestimonialsWrapper";
import { getCachedAdminTestimonialsPayload } from "@/lib/adminReadPayloads";

export const revalidate = 30;

export default async function AdminTestimonialsPage() {
    const { testimonials, naverPlaceUrl } = await getCachedAdminTestimonialsPayload();

    return <TestimonialsWrapper testimonials={testimonials} naverPlaceUrl={naverPlaceUrl} />;
}
