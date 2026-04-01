/**
 * 스태프 추가 전화번호 인증 API
 *
 * POST — 인증번호 발송 (6자리 랜덤 → SMS 전송)
 * PUT  — 인증번호 검증 (입력값과 저장값 비교)
 *
 * 메모리 Map에 저장하며 5분 후 자동 만료된다.
 * 서버리스 환경에서 인스턴스가 재시작되면 Map이 초기화되지만,
 * 인증은 즉시 이루어지므로 문제없다.
 */

import { NextRequest, NextResponse } from "next/server";
import { sendSms } from "@/lib/sms";

// ── 인증번호 저장소 (메모리 Map) ──────────────────────────────
// key: 전화번호(하이픈 제거), value: { code, expiresAt }
const verifyMap = new Map<string, { code: string; expiresAt: number }>();

// 인증번호 유효시간: 5분 (밀리초)
const EXPIRY_MS = 5 * 60 * 1000;

/**
 * 6자리 숫자 인증번호 생성
 * Math.random 대신 crypto를 쓸 수도 있지만 SMS 인증 수준에서는 충분하다
 */
function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * POST — 인증번호 발송
 * body: { phone: "01012345678" }
 */
export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json(
        { error: "전화번호가 필요합니다." },
        { status: 400 },
      );
    }

    // 하이픈 제거한 순수 숫자
    const cleanPhone = phone.replace(/-/g, "");

    // 6자리 인증번호 생성
    const code = generateCode();

    // Map에 저장 (같은 번호로 재요청 시 덮어씀)
    verifyMap.set(cleanPhone, {
      code,
      expiresAt: Date.now() + EXPIRY_MS,
    });

    // 솔라피로 SMS 발송
    const sent = await sendSms(
      cleanPhone,
      `[STIZ 농구교실] 스태프 인증번호: ${code} (5분 내 입력)`,
    );

    // 발송 성공 여부와 관계없이 200 응답 (fallback 로그 모드도 성공 취급)
    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    console.error("[verify-phone POST]", e);
    return NextResponse.json(
      { error: "인증번호 발송 실패" },
      { status: 500 },
    );
  }
}

/**
 * PUT — 인증번호 검증
 * body: { phone: "01012345678", code: "123456" }
 */
export async function PUT(req: NextRequest) {
  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return NextResponse.json(
        { error: "전화번호와 인증번호가 필요합니다." },
        { status: 400 },
      );
    }

    const cleanPhone = phone.replace(/-/g, "");
    const entry = verifyMap.get(cleanPhone);

    // 저장된 인증번호가 없는 경우
    if (!entry) {
      return NextResponse.json(
        { error: "인증번호를 먼저 요청해주세요." },
        { status: 400 },
      );
    }

    // 만료 확인
    if (Date.now() > entry.expiresAt) {
      verifyMap.delete(cleanPhone); // 만료된 항목 정리
      return NextResponse.json(
        { error: "인증번호가 만료되었습니다. 다시 요청해주세요." },
        { status: 400 },
      );
    }

    // 코드 일치 확인
    if (entry.code !== code.trim()) {
      return NextResponse.json(
        { error: "인증번호가 일치하지 않습니다." },
        { status: 400 },
      );
    }

    // 성공 — Map에서 제거 (재사용 방지)
    verifyMap.delete(cleanPhone);

    return NextResponse.json({ ok: true, verified: true });
  } catch (e) {
    console.error("[verify-phone PUT]", e);
    return NextResponse.json(
      { error: "인증번호 확인 실패" },
      { status: 500 },
    );
  }
}
