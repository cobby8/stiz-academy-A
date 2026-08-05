/**
 * 수업 사진(Session.photosJSON) 항목을 해석하는 "순수 로직" 모음입니다.
 *
 * 왜 파일을 나눴나?
 * - sessionPhotoStorage.ts 는 Supabase 관리자 클라이언트(서비스 롤 키)를 import 합니다.
 *   그래서 클라이언트 컴포넌트에서 그 파일을 가져다 쓰면 서버 전용 코드가 브라우저 번들로 끌려옵니다.
 * - 파싱 규칙은 서버·클라이언트·테스트에서 완전히 동일해야 하므로,
 *   외부 의존성이 하나도 없는 이 파일에 모아두고 sessionPhotoStorage.ts 는 여기서 다시 내보냅니다.
 *   (기존 import 경로는 그대로 동작합니다.)
 */

export const PRIVATE_SESSION_PHOTO_BUCKET = "staff-session-private";
export const PUBLIC_GALLERY_BUCKET = "uploads";

export type StoredSessionPhoto = {
  id: string;
  type: "image";
  url: string;
  storageBucket: string;
  storagePath: string;
  visibility: "PRIVATE" | "PUBLIC";
};

/** 사진 항목은 구버전(URL 문자열)과 신버전(객체)이 한 배열에 섞여 있을 수 있습니다. */
export type SessionPhotoEntry = string | StoredSessionPhoto;

export function parseSessionPhotoEntries(value: unknown): SessionPhotoEntry[] {
  const parsed = typeof value === "string" ? (() => {
    try { return JSON.parse(value); } catch { return []; }
  })() : value;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is SessionPhotoEntry =>
    (typeof item === "string" && item.length <= 2048) ||
    (typeof item?.id === "string" && item.type === "image" && typeof item.url === "string" && typeof item.storageBucket === "string" && typeof item.storagePath === "string"),
  );
}

export function parseStoredSessionPhotos(value: unknown): StoredSessionPhoto[] {
  return parseSessionPhotoEntries(value).filter((item): item is StoredSessionPhoto => typeof item !== "string");
}

// ── 리포트 화면 표시용 ────────────────────────────────────────────────────────

/** 비공개 사진은 공개 URL이 없고, 권한 검사를 하는 프록시 라우트로만 볼 수 있습니다. */
const PRIVATE_PHOTO_ROUTE = /^\/api\/staff\/sessions\/[^/]+\/photos\/[^/]+$/;

export function privateSessionPhotoUrl(sessionId: string, photoId: string) {
  return `/api/staff/sessions/${sessionId}/photos/${photoId}`;
}

export type SessionReportPhotoView = {
  /** photosJSON 배열에서의 위치 — 삭제할 때 그대로 사용합니다. */
  index: number;
  /** <img src>에 넣을 주소 */
  src: string;
  /** 비공개(초상권 보호) 사진 여부 — 안내 문구에만 씁니다. */
  isPrivate: boolean;
};

/**
 * photosJSON(문자열/객체/혼재 배열)을 화면에 그릴 수 있는 형태로 변환합니다.
 * - 문자열 항목: 그대로 사용(공개 업로드 URL 또는 비공개 프록시 경로)
 * - 객체 항목: 비공개면 프록시 경로를 세션 기준으로 다시 만들고, 공개면 저장된 url 사용
 */
export function toSessionReportPhotoViews(value: unknown, sessionId: string): SessionReportPhotoView[] {
  return parseSessionPhotoEntries(value).flatMap((entry, index) => {
    if (typeof entry === "string") {
      const src = entry.trim();
      if (!src) return [];
      return [{ index, src, isPrivate: PRIVATE_PHOTO_ROUTE.test(src) }];
    }
    const isPrivate = entry.visibility === "PRIVATE" || entry.storageBucket === PRIVATE_SESSION_PHOTO_BUCKET;
    // 비공개 사진은 저장된 url 대신 현재 세션 기준 프록시 경로를 쓰는 편이 안전합니다.
    const src = isPrivate && sessionId ? privateSessionPhotoUrl(sessionId, entry.id) : entry.url;
    if (!src) return [];
    return [{ index, src, isPrivate }];
  });
}

/**
 * 사진 한 장을 제거한 photosJSON 문자열을 돌려줍니다.
 * 남는 항목은 원래 형태(문자열/객체)를 그대로 유지합니다.
 */
export function removeSessionPhotoEntryAt(value: unknown, index: number): string {
  const entries = parseSessionPhotoEntries(value).filter((_, i) => i !== index);
  return JSON.stringify(entries);
}

/** 새로 업로드한 사진 URL을 뒤에 붙인 photosJSON 문자열을 돌려줍니다. */
export function appendSessionPhotoUrls(value: unknown, urls: string[]): string {
  const entries = parseSessionPhotoEntries(value);
  const added = urls.map((url) => url.trim()).filter((url) => url.length > 0 && url.length <= 2048);
  return JSON.stringify([...entries, ...added]);
}
