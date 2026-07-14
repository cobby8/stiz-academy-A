import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth-guard";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg"]);

export async function POST(req: Request) {
  try {
    await requireStaff();
    const form = await req.formData();
    const audio = form.get("audio");
    const durationMs = Number(form.get("durationMs"));
    if (!(audio instanceof File)) return NextResponse.json({ error: "음성 파일이 없습니다." }, { status: 400 });
    if (!ALLOWED_MIME.has(audio.type)) return NextResponse.json({ error: "지원하지 않는 음성 형식입니다." }, { status: 400 });
    if (audio.size > MAX_BYTES) return NextResponse.json({ error: "음성은 10MB 이하여야 합니다." }, { status: 400 });
    if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 60_500) {
      return NextResponse.json({ error: "한 번에 최대 60초까지 녹음할 수 있습니다." }, { status: 400 });
    }
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "음성 인식 설정(GEMINI_API_KEY)이 필요합니다." }, { status: 503 });

    // 원본은 메모리에서 API로 한 번 전달할 뿐 저장소나 DB에 기록하지 않습니다.
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: process.env.GEMINI_TRANSCRIBE_MODEL || "gemini-2.0-flash" });
    const result = await model.generateContent([
      { text: "다음 한국어 음성을 정확히 받아쓰기 하세요. 설명이나 요약 없이 인식된 문장만 출력하세요." },
      { inlineData: { mimeType: audio.type, data: Buffer.from(await audio.arrayBuffer()).toString("base64") } },
    ]);
    const text = result.response.text().trim();
    if (!text) return NextResponse.json({ error: "음성을 인식하지 못했습니다. 다시 녹음해 주세요." }, { status: 422 });
    return NextResponse.json({ text });
  } catch (error) {
    // 음성 내용과 전사 본문은 로그에 남기지 않습니다.
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error("[staff-transcribe] request failed", { name });
    return NextResponse.json({ error: "음성 인식에 실패했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
