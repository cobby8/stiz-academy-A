import SmsClient from "./SmsClient";

// 관리자 문자 발송 페이지 — 항상 최신 데이터 (코치 목록 등)
export const dynamic = "force-dynamic";

export default function AdminSmsPage() {
    return <SmsClient />;
}
