/**
 * POST /api/chat — 학부모 상담 챗봇 API
 *
 * 프론트엔드에서 대화 히스토리를 받아 Gemini API에 전달하고,
 * 응답을 돌려주는 "주문 창구" 역할을 한다.
 *
 * - DB에서 프로그램/학원 정보를 조회하여 시스템 프롬프트에 동적 주입
 * - unstable_cache로 5분 캐시 (매 대화마다 DB를 치지 않음)
 * - PgBouncer 호환: $queryRawUnsafe 사용
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

// --- Gemini 클라이언트 초기화 (모듈 레벨에서 1회만) ---
const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// --- DB 데이터를 5분 캐시로 가져오는 함수들 ---

// 프로그램 정보 (수업명, 대상, 요일, 수강료 등)
const getCachedPrograms = unstable_cache(
  async () => {
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        // description 추가: 프로그램 설명을 시스템 프롬프트에 포함시키기 위함
        `SELECT id, name, description, "targetAge", days, "weeklyFrequency",
                price, "priceWeek1", "priceWeek2", "priceWeek3",
                "priceDaily", "shuttleFeeOverride"
         FROM "Program" ORDER BY "order" ASC`
      );
      // 토큰 절약을 위해 필요한 필드만 반환
      return rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description ?? null,
        targetAge: r.targetAge ?? r.targetage,
        days: r.days,
        weeklyFrequency: r.weeklyFrequency ?? r.weeklyfrequency,
        price: Number(r.price ?? 0),
        priceWeek1: r.priceWeek1 != null ? Number(r.priceWeek1) : null,
        priceWeek2: r.priceWeek2 != null ? Number(r.priceWeek2) : null,
        priceWeek3: r.priceWeek3 != null ? Number(r.priceWeek3) : null,
        priceDaily: r.priceDaily != null ? Number(r.priceDaily) : null,
        shuttleFeeOverride:
          r.shuttleFeeOverride != null
            ? Number(r.shuttleFeeOverride)
            : null,
      }));
    } catch (e) {
      console.error("[chat] getPrograms failed:", e);
      return [];
    }
  },
  ["chat-programs"],
  { revalidate: 300 } // 5분 캐시
);

// 학원 설정 (전화번호, 주소)
const getCachedSettings = unstable_cache(
  async () => {
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT "contactPhone", address FROM "AcademySettings" WHERE id = 'singleton' LIMIT 1`
      );
      if (rows[0]) {
        return {
          contactPhone:
            rows[0].contactPhone ?? rows[0].contactphone ?? "010-0000-0000",
          address: rows[0].address ?? "",
        };
      }
    } catch (e) {
      console.error("[chat] getSettings failed:", e);
    }
    return { contactPhone: "010-0000-0000", address: "" };
  },
  ["chat-settings"],
  { revalidate: 300 }
);

// 반(Class) 정보 — 프로그램별 구체적인 수업 시간/요일을 챗봇이 안내하기 위함
const getCachedClasses = unstable_cache(
  async () => {
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT c.id, c."programId", c.name, c."dayOfWeek", c."startTime", c."endTime",
                c.location, c.capacity
         FROM "Class" c
         ORDER BY c."programId", c."dayOfWeek", c."startTime" ASC`
      );
      return rows.map((r: any) => ({
        programId: r.programId ?? r.programid,
        name: r.name,
        dayOfWeek: r.dayOfWeek ?? r.dayofweek,
        startTime: r.startTime ?? r.starttime,
        endTime: r.endTime ?? r.endtime,
        location: r.location ?? null,
        capacity: Number(r.capacity ?? 0),
      }));
    } catch (e) {
      console.error("[chat] getClasses failed:", e);
      return [];
    }
  },
  ["chat-classes"],
  { revalidate: 300 } // 5분 캐시
);

// --- 시스템 프롬프트 조립 ---
function buildSystemPrompt(
  programs: any[],
  classes: any[],
  settings: { contactPhone: string; address: string }
): string {
  // 프로그램별 반 정보를 그룹핑하여 가독성 높은 텍스트로 변환
  const programInfo = programs
    .map((p) => {
      // 해당 프로그램에 속하는 반 목록 필터링
      const programClasses = classes.filter((c) => c.programId === p.id);

      // 수강료 정보를 주 횟수별로 정리
      const priceLines: string[] = [];
      if (p.priceWeek1 != null) priceLines.push(`  - 주1회: ${p.priceWeek1.toLocaleString()}원`);
      if (p.priceWeek2 != null) priceLines.push(`  - 주2회: ${p.priceWeek2.toLocaleString()}원`);
      if (p.priceWeek3 != null) priceLines.push(`  - 주3회: ${p.priceWeek3.toLocaleString()}원`);
      // 주 횟수별 가격이 없으면 기본 price 사용
      if (priceLines.length === 0 && p.price > 0) {
        priceLines.push(`  - 월 수강료: ${p.price.toLocaleString()}원`);
      }
      if (p.priceDaily != null) priceLines.push(`  - 1일 체험: ${p.priceDaily.toLocaleString()}원`);
      if (p.shuttleFeeOverride != null) priceLines.push(`  - 셔틀비: 월 ${p.shuttleFeeOverride.toLocaleString()}원`);

      // 반 정보 텍스트
      const classLines = programClasses.length > 0
        ? programClasses.map((c) => {
            const loc = c.location ? ` (${c.location})` : "";
            return `  - ${c.name}: ${c.dayOfWeek} ${c.startTime}~${c.endTime}${loc}`;
          })
        : ["  - (등록된 반 없음)"];

      // 프로그램 한 블록 조립
      const lines = [`### ${p.name}`];
      if (p.description) lines.push(`설명: ${p.description}`);
      if (p.targetAge) lines.push(`대상: ${p.targetAge}`);
      if (p.days) lines.push(`수업 요일: ${p.days}`);
      lines.push(`수강료:`);
      lines.push(...priceLines);
      lines.push(`반 구성:`);
      lines.push(...classLines);
      return lines.join("\n");
    })
    .join("\n\n");

  return `당신은 STIZ 농구교실의 학부모 상담 도우미입니다.

## 학원 소개
- STIZ 농구교실은 다산신도시에 있는 농구교실입니다.
- 대부분의 학생이 취미/건강/자연스러운 신체활동 목적으로 수업합니다.
- 전문 선수 양성보다는 아이들이 즐겁게 운동하는 것을 중시합니다.
- 전화번호: ${settings.contactPhone}
- 주소: ${settings.address}

## 상담 규칙 (반드시 지킬 것)
- 친근하고 편안한 톤으로 대화하세요. 학부모의 불안감을 해소하는 것이 목표입니다.
- 반말이 아닌 존댓말을 사용하세요.
- 답변은 간결하게 3-5문장 이내로 하세요. 불필요하게 길게 늘이지 마세요.
- 학원/수업과 관련 없는 질문(정치, 연예, 일반 상식 등)에는 "죄송합니다, 수업 관련 문의에 대해서만 안내드릴 수 있습니다."라고 정중히 안내하세요.
- 아래 제공된 프로그램/반 정보에 없는 내용을 지어내지 마세요. 모르는 것은 전화 문의를 안내하세요.
- 수강료를 안내할 때는 반드시 아래 데이터에 있는 금액만 사용하세요. 임의로 할인이나 추가 비용을 언급하지 마세요.
- 다른 학원이나 경쟁 업체에 대한 비교/언급을 하지 마세요.

## 체험수업 안내
- 체험수업을 적극 권유하세요: "한번 체험해보시고 결정하시는 게 좋습니다"
- 체험수업은 실제 수강할 수업에 들어가서 해봅니다 (별도 체험반이 아님).
- 체험수업 신청은 전화(${settings.contactPhone})로 안내하세요.

## 셔틀
- 셔틀버스를 운행하고 있습니다.
- 셔틀 노선/시간 등 세부사항은 전화로 문의하도록 안내하세요.

## 초보자 안내
- 농구를 처음 하는 아이도 걱정 없다고 안내하세요.
- "반 분위기에만 잘 적응하면 처음이어도 크게 문제 없습니다"

## 상담 흐름
1. 학부모가 문의하면 먼저 아이의 학년을 물어보세요.
2. 학년에 맞는 프로그램과 반을 추천하세요.
3. 해당 반의 수업 요일, 시간, 수강료(주 횟수별)를 안내하세요.
4. 체험수업을 권유하세요.

## 현재 운영 중인 프로그램 및 반 정보
${programInfo}`;
}

// --- POST 핸들러 ---
export async function POST(request: NextRequest) {
  // Gemini API 키가 없으면 명확한 에러 반환
  if (!genAI) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  try {
    // 요청 본문 파싱
    const body = await request.json();
    const messages: Array<{ role: string; content: string }> =
      body.messages;

    // messages 유효성 검사
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages 배열이 필요합니다." },
        { status: 400 }
      );
    }

    // DB에서 프로그램/반/학원 설정을 동시 조회 (5분 캐시)
    const [programs, classes, settings] = await Promise.all([
      getCachedPrograms(),
      getCachedClasses(),
      getCachedSettings(),
    ]);

    // 시스템 프롬프트 조립 (고정 부분 + DB 동적 데이터)
    const systemPrompt = buildSystemPrompt(programs, classes, settings);

    // Gemini 모델 초기화 (시스템 프롬프트 포함)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
    });

    // 대화 히스토리를 Gemini 형식으로 변환
    // Gemini SDK의 role은 "user" | "model"이므로 그대로 전달
    const geminiHistory = messages.slice(0, -1).map((m) => ({
      role: m.role as "user" | "model",
      parts: [{ text: m.content }],
    }));

    // 마지막 메시지(현재 사용자 입력)를 분리
    const lastMessage = messages[messages.length - 1].content;

    // Gemini 채팅 세션 시작 + 응답 받기
    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(lastMessage);
    const reply = result.response.text();

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("[chat] Gemini API error:", error);
    return NextResponse.json(
      {
        error:
          "답변을 생성하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      },
      { status: 500 }
    );
  }
}
