/**
 * SMS 템플릿 유틸 — 트리거별 메시지 조회 + 변수 치환 + 초기 seed
 *
 * 왜 이 파일이 필요한가?
 * 기존에는 SMS 메시지가 코드에 하드코딩되어 관리자가 내용을 바꿀 수 없었다.
 * 이제 DB에 저장된 템플릿을 조회하고, {{변수}}를 실제 값으로 치환하여 발송한다.
 *
 * DDL ensure 패턴: 테이블이 없으면 자동 생성 + 기본 템플릿 10개 seed
 * $queryRawUnsafe 사용: PgBouncer 트랜잭션 모드 호환
 */

import { prisma } from "@/lib/prisma";

// ── DDL ensure: SmsTemplate 테이블이 없으면 생성 ──────────────────────────────
let _smsTemplateEnsured = false;

export async function ensureSmsTemplateTable() {
    if (_smsTemplateEnsured) return;
    try {
        // 테이블 생성 (존재하면 무시)
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "SmsTemplate" (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                trigger TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                target TEXT NOT NULL,
                body TEXT NOT NULL,
                "isActive" BOOLEAN DEFAULT true,
                description TEXT,
                variables TEXT,
                "createdAt" TIMESTAMPTZ DEFAULT NOW(),
                "updatedAt" TIMESTAMPTZ DEFAULT NOW()
            )
        `);
    } catch (e) {
        console.warn("[DDL] SmsTemplate ensure failed:", (e as Error).message);
    }
    _smsTemplateEnsured = true;
}

// ── 기본 템플릿 10개 seed 데이터 ──────────────────────────────────────────────
// 각 항목: [trigger, name, target, body, description, variables(JSON)]
const DEFAULT_TEMPLATES: [string, string, string, string, string, string][] = [
    [
        "TRIAL_NEW_ADMIN",
        "체험 신청 접수 (관리자)",
        "ADMIN",
        "[STIZ] 새 체험수업 신청\n{{childName}} ({{childGrade}}) - {{parentName}}",
        "학부모가 체험수업을 신청하면 관리자에게 발송",
        '["childName","childGrade","parentName","parentPhone"]',
    ],
    [
        "TRIAL_NEW_COACH",
        "체험 신청 접수 (코치)",
        "COACH",
        "[STIZ] 새 체험수업 신청\n{{childName}} ({{childGrade}})",
        "학부모가 체험수업을 신청하면 코치에게 발송",
        '["childName","childGrade","parentName"]',
    ],
    [
        "ENROLL_NEW_ADMIN",
        "수강 신청 접수 (관리자)",
        "ADMIN",
        "[STIZ] 새 수강 신청\n{{childName}} ({{childGrade}}) - {{parentName}}",
        "학부모가 수강 신청하면 관리자에게 발송",
        '["childName","childGrade","parentName","parentPhone"]',
    ],
    [
        "ENROLL_NEW_COACH",
        "수강 신청 접수 (코치)",
        "COACH",
        "[STIZ] 새 수강 신청\n{{childName}} ({{childGrade}})",
        "학부모가 수강 신청하면 코치에게 발송",
        '["childName","childGrade","parentName"]',
    ],
    [
        "TRIAL_CONFIRM_PARENT",
        "체험 신청 확인 (학부모)",
        "PARENT",
        "[STIZ] {{childName}} 체험수업 신청이 접수되었습니다.\n일정 확정 시 다시 안내드리겠습니다.\n문의: {{academyPhone}}",
        "체험 신청 직후 학부모에게 접수 확인 발송",
        '["childName","parentName","academyPhone"]',
    ],
    [
        "TRIAL_SCHEDULED_PARENT",
        "체험 일정 확정 (학부모)",
        "PARENT",
        "[STIZ] {{childName}} 체험수업 일정이 확정되었습니다.\n일시: {{scheduledDate}}\n반: {{className}}\n문의: {{academyPhone}}",
        "관리자가 체험 일정을 SCHEDULED로 변경하면 학부모에게 발송",
        '["childName","scheduledDate","className","academyPhone"]',
    ],
    [
        "ENROLL_CONFIRM_PARENT",
        "수강 신청 확인 (학부모)",
        "PARENT",
        "[STIZ] {{childName}} 수강 신청이 접수되었습니다.\n승인 후 안내드리겠습니다.\n문의: {{academyPhone}}",
        "수강 신청 직후 학부모에게 접수 확인 발송",
        '["childName","parentName","academyPhone"]',
    ],
    [
        "ENROLL_APPROVED_PARENT",
        "수강 확정 (학부모)",
        "PARENT",
        "[STIZ] {{childName}} 수강이 확정되었습니다.\n배정 반: {{className}}\n상세 안내는 별도 연락드리겠습니다.",
        "관리자가 수강 신청을 승인하면 학부모에게 발송",
        '["childName","className","academyPhone"]',
    ],
    [
        "INVOICE_PARENT",
        "수납 안내 (학부모)",
        "PARENT",
        "[STIZ] {{month}}월 수강료 안내\n{{childName}}: {{amount}}원\n납부기한: {{dueDate}}",
        "월별 청구서 생성 시 학부모에게 발송",
        '["childName","month","amount","dueDate"]',
    ],
    [
        "UNPAID_PARENT",
        "미납 알림 (학부모)",
        "PARENT",
        "[STIZ] 미납 수납 안내\n{{childName}}: {{unpaidCount}}건 ({{totalAmount}}원)\n확인 부탁드립니다.",
        "미납 알림 일괄 발송 시 학부모에게 발송",
        '["childName","unpaidCount","totalAmount"]',
    ],
];

/**
 * ensureSmsTemplates — 템플릿이 0개면 기본 10개를 INSERT
 *
 * DDL 패턴: 앱 시작 또는 첫 조회 시 1회만 실행
 * ON CONFLICT DO NOTHING: 이미 있는 trigger는 무시 (관리자가 수정한 내용 보존)
 */
export async function ensureSmsTemplates(): Promise<void> {
    await ensureSmsTemplateTable();

    try {
        // 이미 데이터가 있으면 스킵 (성능: 매번 10개 INSERT 시도 방지)
        const existing = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
            `SELECT COUNT(*)::int AS cnt FROM "SmsTemplate"`
        );
        if ((existing[0]?.cnt ?? 0) >= DEFAULT_TEMPLATES.length) return;

        // 기본 템플릿 삽입 — ON CONFLICT 로 이미 있는 trigger는 무시
        for (const [trigger, name, target, body, description, variables] of DEFAULT_TEMPLATES) {
            await prisma.$executeRawUnsafe(
                `INSERT INTO "SmsTemplate" (id, trigger, name, target, body, "isActive", description, variables, "createdAt", "updatedAt")
                 VALUES (gen_random_uuid()::text, $1, $2, $3, $4, true, $5, $6, NOW(), NOW())
                 ON CONFLICT (trigger) DO NOTHING`,
                trigger, name, target, body, description, variables,
            );
        }
    } catch (e) {
        console.error("[ensureSmsTemplates] seed failed:", e);
    }
}

// ── 변수 치환 함수 ────────────────────────────────────────────────────────────
// body 문자열 안의 {{key}}를 variables 객체의 값으로 교체
// 매칭되지 않는 변수는 빈 문자열로 대체 (에러 방지)
export function renderTemplate(body: string, variables: Record<string, string>): string {
    return body.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || "");
}

/**
 * renderSmsTemplate — 트리거 코드로 템플릿을 조회하고 변수를 치환하여 최종 메시지 반환
 *
 * @param trigger    트리거 코드 (예: "TRIAL_NEW_ADMIN")
 * @param variables  치환할 변수 객체 (예: { childName: "홍길동", ... })
 * @returns          치환된 메시지 문자열. 비활성(isActive=false)이면 null 반환
 */
export async function renderSmsTemplate(
    trigger: string,
    variables: Record<string, string>,
): Promise<string | null> {
    // DDL + seed 보장
    await ensureSmsTemplates();

    try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT body, "isActive" FROM "SmsTemplate" WHERE trigger = $1 LIMIT 1`,
            trigger,
        );

        if (rows.length === 0) return null;

        const tpl = rows[0];
        // 비활성 템플릿이면 발송하지 않음
        const isActive = tpl.isActive ?? tpl.isactive;
        if (!isActive) return null;

        return renderTemplate(tpl.body, variables);
    } catch (e) {
        console.error(`[renderSmsTemplate] trigger=${trigger} failed:`, e);
        return null;
    }
}

// ── 자연어 키워드 → 변수 치환 매핑 ────────────────────────────────────────────
// 관리자가 한글로 입력한 키워드를 {{변수}}로 자동 변환하는 데 사용
export const KEYWORD_TO_VARIABLE: Record<string, string> = {
    // childName
    "아이이름": "{{childName}}", "학생이름": "{{childName}}", "수강생이름": "{{childName}}",
    // childGrade
    "학년": "{{childGrade}}",
    // parentName
    "학부모이름": "{{parentName}}", "보호자이름": "{{parentName}}", "부모이름": "{{parentName}}",
    // parentPhone
    "학부모연락처": "{{parentPhone}}", "보호자전화": "{{parentPhone}}", "부모전화": "{{parentPhone}}",
    // className
    "반이름": "{{className}}", "수강반": "{{className}}", "수업반": "{{className}}",
    // scheduledDate
    "체험일시": "{{scheduledDate}}", "체험날짜": "{{scheduledDate}}", "예정일": "{{scheduledDate}}",
    // amount
    "금액": "{{amount}}", "수강료": "{{amount}}", "납부금": "{{amount}}",
    // month
    "월": "{{month}}", "해당월": "{{month}}",
    // academyPhone
    "학원전화": "{{academyPhone}}", "문의전화": "{{academyPhone}}", "연락처": "{{academyPhone}}",
    // preferredSlot
    "희망시간": "{{preferredSlot}}", "희망교시": "{{preferredSlot}}",
};

/**
 * autoConvertKeywords — 본문에서 한글 키워드를 찾아 {{변수}}로 자동 치환
 *
 * @param body      원본 메시지 본문
 * @returns         { converted: 치환된 본문, changes: 변환된 키워드 목록 }
 */
export function autoConvertKeywords(body: string): { converted: string; changes: string[] } {
    let converted = body;
    const changes: string[] = [];

    // 긴 키워드부터 먼저 매칭 (예: "학부모연락처"가 "연락처"보다 먼저)
    const sortedKeywords = Object.keys(KEYWORD_TO_VARIABLE).sort((a, b) => b.length - a.length);

    for (const keyword of sortedKeywords) {
        if (converted.includes(keyword)) {
            const variable = KEYWORD_TO_VARIABLE[keyword];
            converted = converted.replaceAll(keyword, variable);
            changes.push(`"${keyword}" -> ${variable}`);
        }
    }

    return { converted, changes };
}

// ── 미리보기용 샘플 데이터 ────────────────────────────────────────────────────
export const SAMPLE_VARIABLES: Record<string, string> = {
    childName: "홍길동",
    childGrade: "초4",
    parentName: "김철수",
    parentPhone: "010-1234-5678",
    className: "초등 A반",
    scheduledDate: "2026-04-05 (토) 14:00",
    amount: "150,000",
    month: "4",
    dueDate: "4월 10일",
    academyPhone: "010-0000-0000",
    preferredSlot: "토 14:00",
    unpaidCount: "2",
    totalAmount: "300,000",
};
