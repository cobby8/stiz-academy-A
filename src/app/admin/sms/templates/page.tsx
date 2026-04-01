/**
 * SMS 템플릿 관리 페이지 — Server Component
 *
 * DB에서 템플릿 목록을 조회한 후 클라이언트 컴포넌트에 전달한다.
 * ensureSmsTemplates()가 내부적으로 DDL + seed를 보장하므로 별도 처리 불필요.
 */

import { getSmsTemplates } from "@/lib/queries";
import SmsTemplateClient from "./SmsTemplateClient";

export const dynamic = "force-dynamic";

export default async function SmsTemplatesPage() {
    // 전체 템플릿 조회 (DDL + seed 자동)
    const templates = await getSmsTemplates();

    return <SmsTemplateClient templates={templates} />;
}
