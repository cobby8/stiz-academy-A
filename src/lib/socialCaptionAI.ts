import { GoogleGenerativeAI } from "@google/generative-ai";

export type SocialMediaItem = {
  url: string;
  type: "image" | "video";
};

export type SocialCaptionDraft = {
  title: string;
  caption: string;
  hashtags: string;
};

const DEFAULT_HASHTAGS = [
  "#스티즈농구교실",
  "#스티즈농구교실다산점",
  "#다산농구",
  "#남양주농구",
  "#유소년농구",
  "#농구수업",
];

function compactText(value: unknown, fallback = "") {
  return String(value || fallback)
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeHashtags(value: unknown) {
  const raw = Array.isArray(value) ? value.join(" ") : String(value || "");
  const tags = raw
    .split(/\s+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));

  const merged = [...tags, ...DEFAULT_HASHTAGS];
  return Array.from(new Set(merged)).slice(0, 18).join(" ");
}

function fallbackDraft(lessonType?: string | null, memo?: string | null): SocialCaptionDraft {
  const title = lessonType ? `${lessonType} 수업 스케치` : "STIZ 수업 스케치";
  const memoLine = memo?.trim() ? `\n\n오늘 포인트: ${memo.trim()}` : "";

  return {
    title,
    caption:
      `오늘도 코트 위에서 기본기와 자신감을 차근차근 쌓았습니다.${memoLine}\n\n` +
      "작은 성공 경험이 다음 플레이를 더 과감하게 만듭니다.",
    hashtags: DEFAULT_HASHTAGS.join(" "),
  };
}

function parseJson(text: string) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function imagePartFromUrl(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const mimeType = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  if (!mimeType.startsWith("image/")) return null;

  const buffer = Buffer.from(await res.arrayBuffer());
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType,
    },
  };
}

export async function generateSocialCaptionDraft({
  mediaItems,
  lessonType,
  memo,
}: {
  mediaItems: SocialMediaItem[];
  lessonType?: string | null;
  memo?: string | null;
}): Promise<SocialCaptionDraft> {
  const fallback = fallbackDraft(lessonType, memo);
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return fallback;

  const imageUrls = mediaItems
    .filter((item) => item.type === "image")
    .map((item) => item.url)
    .filter((url) => /^https?:\/\//i.test(url))
    .slice(0, 3);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const imageParts = (await Promise.all(imageUrls.map(imagePartFromUrl))).filter(
      (part): part is NonNullable<Awaited<ReturnType<typeof imagePartFromUrl>>> => part !== null,
    );

    const prompt = `
You write Korean Instagram captions for STIZ Basketball Academy Dasan.
Create a natural feed post based on the uploaded class photos and teacher memo.

Rules:
- Do not guess or mention children's names, school names, exact ages, phone numbers, or private details.
- Keep the tone warm, professional, energetic, and not exaggerated.
- Make the caption suitable for parents who want to see class atmosphere.
- Return only JSON with keys: title, caption, hashtags.
- hashtags can be a string or array. Include local/basketball/STIZ tags.

Lesson type: ${lessonType || "수업"}
Teacher memo: ${memo || "없음"}
`;

    const result = await model.generateContent([{ text: prompt }, ...imageParts]);
    const parsed = parseJson(result.response.text());

    if (!parsed) return fallback;

    return {
      title: compactText(parsed.title, fallback.title).slice(0, 80),
      caption: compactText(parsed.caption, fallback.caption).slice(0, 1800),
      hashtags: normalizeHashtags(parsed.hashtags || fallback.hashtags),
    };
  } catch (error) {
    console.warn("[social-caption-ai] fallback used:", error);
    return fallback;
  }
}
