import FaqAdminClient from "./FaqAdminClient";
import { getCachedAdminFaqPayload } from "@/lib/adminReadPayloads";

export const revalidate = 30;

export default async function AdminFaqPage() {
    const { faqs } = await getCachedAdminFaqPayload();

    return <FaqAdminClient faqs={faqs} />;
}
