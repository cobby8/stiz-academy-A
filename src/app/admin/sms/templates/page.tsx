/**
 * SMS 템플릿 관리 페이지 — Server Component
 *
 * 템플릿 목록은 클라이언트 진입 후 API에서 천천히 불러온다.
 * ensureSmsTemplates()의 DDL + seed 보장은 API 경계 안에서 처리한다.
 */

import SmsTemplateClient from "./SmsTemplateClient";
import { getCachedAdminSmsTemplatesPayload } from "@/lib/adminReadPayloads";

export const revalidate = 30;

export default async function SmsTemplatesPage() {
    const { templates } = await getCachedAdminSmsTemplatesPayload();

    return <SmsTemplateClient templates={templates} />;
}
