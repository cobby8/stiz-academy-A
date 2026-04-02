"use server";

/**
 * 스태프 초대 수락 공개 액션 — 로그인 없이 초대 토큰으로 접근
 *
 * 플로우:
 * 1. getInvitation(token) — 초대 정보 확인
 * 2. sendInviteVerification(token) — 초대 전화번호로 인증번호 SMS 발송
 * 3. verifyInviteCode(token, code) — 인증번호 검증
 * 4. acceptInvitation(token, password) — Supabase Auth 가입 + User 레코드 생성 + 초대 ACCEPTED
 */

import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/sms";
import { createAdminClient } from "@/lib/supabase/admin";

// ── 인증번호 저장소 (메모리 Map) ──────────────────────────────
// key: 초대 토큰, value: { code, phone, expiresAt, verified }
const inviteVerifyMap = new Map<
    string,
    { code: string; phone: string; expiresAt: number; verified: boolean }
>();

// 인증번호 유효시간: 5분
const EXPIRY_MS = 5 * 60 * 1000;

/**
 * 6자리 인증번호 생성
 */
function generateCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * getInvitation — 토큰으로 초대 정보 조회 (공개)
 * PENDING 상태 + 만료 전인 초대만 유효하게 반환
 */
export async function getInvitation(token: string) {
    try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id, token, name, phone, role, status, "expiresAt", "createdAt"
             FROM "StaffInvitation"
             WHERE token = $1
             LIMIT 1`,
            token,
        );

        if (rows.length === 0) return { error: "존재하지 않는 초대입니다." };

        const r = rows[0];
        const status = r.status;
        const expiresAt = new Date(r.expiresAt ?? r.expiresat);

        // 상태별 분기
        if (status === "ACCEPTED") return { error: "이미 수락된 초대입니다." };
        if (status === "CANCELLED") return { error: "취소된 초대입니다." };
        if (expiresAt < new Date()) return { error: "만료된 초대입니다. 원장에게 재발송을 요청해주세요." };

        // 전화번호 마스킹 (010-****-5678 형태)
        const phone = r.phone || "";
        const maskedPhone = phone.length >= 7
            ? phone.slice(0, 3) + "-****-" + phone.slice(-4)
            : "***";

        return {
            data: {
                id: r.id,
                token: r.token,
                name: r.name,
                maskedPhone,
                role: r.role,
                expiresAt: expiresAt.toISOString(),
            },
        };
    } catch (e) {
        console.error("[getInvitation] failed:", e);
        return { error: "초대 정보를 불러올 수 없습니다." };
    }
}

/**
 * sendInviteVerification — 초대 전화번호로 인증번호 발송 (공개)
 * 초대에 등록된 전화번호로만 발송 (다른 번호 불가)
 */
export async function sendInviteVerification(token: string) {
    try {
        // 초대 정보 조회
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT phone, status, "expiresAt"
             FROM "StaffInvitation"
             WHERE token = $1 AND status = 'PENDING'
             LIMIT 1`,
            token,
        );

        if (rows.length === 0) {
            return { error: "유효하지 않은 초대입니다." };
        }

        const inv = rows[0];
        const expiresAt = new Date(inv.expiresAt ?? inv.expiresat);
        if (expiresAt < new Date()) {
            return { error: "만료된 초대입니다." };
        }

        const phone = inv.phone;
        const code = generateCode();

        // Map에 저장 (같은 토큰으로 재요청 시 덮어씀)
        inviteVerifyMap.set(token, {
            code,
            phone,
            expiresAt: Date.now() + EXPIRY_MS,
            verified: false,
        });

        // SMS 발송
        await sendSms(
            phone,
            `[STIZ 농구교실] 스태프 가입 인증번호: ${code} (5분 내 입력)`,
        );

        return { ok: true };
    } catch (e) {
        console.error("[sendInviteVerification] failed:", e);
        return { error: "인증번호 발송 실패" };
    }
}

/**
 * verifyInviteCode — 인증번호 검증 (공개)
 * 성공하면 Map에 verified=true 설정 → acceptInvitation에서 확인
 */
export async function verifyInviteCode(token: string, code: string) {
    const entry = inviteVerifyMap.get(token);

    if (!entry) {
        return { error: "인증번호를 먼저 요청해주세요." };
    }

    // 만료 확인
    if (Date.now() > entry.expiresAt) {
        inviteVerifyMap.delete(token);
        return { error: "인증번호가 만료되었습니다. 다시 요청해주세요." };
    }

    // 코드 일치 확인
    if (entry.code !== code.trim()) {
        return { error: "인증번호가 일치하지 않습니다." };
    }

    // 인증 성공 — verified 플래그 설정 (Map에서 삭제하지 않음, acceptInvitation에서 확인)
    entry.verified = true;
    inviteVerifyMap.set(token, entry);

    return { ok: true, verified: true };
}

/**
 * acceptInvitation — 초대 수락 + 계정 생성 (공개)
 *
 * 1) 인증 완료 여부 확인 (verifyInviteCode 통과 필수)
 * 2) Supabase Auth signUp: email = {phone}@staff.stiz.kr
 * 3) User 테이블에 레코드 생성 (role = 초대에 지정된 역할)
 * 4) StaffInvitation 상태를 ACCEPTED로 업데이트
 */
export async function acceptInvitation(token: string, password: string) {
    // 비밀번호 유효성 검사
    if (!password || password.length < 6) {
        return { error: "비밀번호는 6자 이상이어야 합니다." };
    }

    // 인증 완료 여부 확인
    const verifyEntry = inviteVerifyMap.get(token);
    if (!verifyEntry || !verifyEntry.verified) {
        return { error: "전화번호 인증이 필요합니다." };
    }

    try {
        // 초대 정보 조회 (PENDING 상태만)
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id, name, phone, role, status, "expiresAt"
             FROM "StaffInvitation"
             WHERE token = $1 AND status = 'PENDING'
             LIMIT 1`,
            token,
        );

        if (rows.length === 0) {
            return { error: "유효하지 않은 초대입니다." };
        }

        const inv = rows[0];
        const expiresAt = new Date(inv.expiresAt ?? inv.expiresat);
        if (expiresAt < new Date()) {
            return { error: "만료된 초대입니다." };
        }

        // Supabase Auth 계정 생성
        // email = {phone}@staff.stiz.kr (스태프 전용 가상 이메일)
        const staffEmail = `${inv.phone}@staff.stiz.kr`;
        const supabaseAdmin = createAdminClient();

        // 이미 같은 이메일로 Auth 계정이 있는지 확인
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const alreadyExists = existingUsers?.users?.find(
            (u: any) => u.email === staffEmail,
        );
        if (alreadyExists) {
            return { error: "이미 가입된 계정입니다. 로그인 페이지에서 로그인해주세요." };
        }

        // Supabase Auth signUp (admin API로 이메일 확인 건너뛰기)
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: staffEmail,
            password,
            email_confirm: true, // 이메일 확인 건너뛰기
            user_metadata: {
                name: inv.name,
                role: inv.role,
            },
        });

        if (authError || !authData.user) {
            console.error("[acceptInvitation] Supabase Auth failed:", authError);
            return { error: "계정 생성 실패: " + (authError?.message || "알 수 없는 오류") };
        }

        const authUserId = authData.user.id;

        // User 테이블에 레코드 생성
        await prisma.$executeRawUnsafe(
            `INSERT INTO "User" (id, email, name, phone, role, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5::"Role", NOW(), NOW())
             ON CONFLICT (id) DO NOTHING`,
            authUserId,
            staffEmail,
            inv.name,
            inv.phone,
            inv.role,
        );

        // StaffInvitation 상태 업데이트
        await prisma.$executeRawUnsafe(
            `UPDATE "StaffInvitation"
             SET status = 'ACCEPTED', "acceptedAt" = NOW(), "acceptedUserId" = $1, "updatedAt" = NOW()
             WHERE token = $2`,
            authUserId,
            token,
        );

        // 인증 Map 정리
        inviteVerifyMap.delete(token);

        return { ok: true, email: staffEmail };
    } catch (e) {
        console.error("[acceptInvitation] failed:", e);
        return { error: (e as Error).message || "가입 처리 실패" };
    }
}
